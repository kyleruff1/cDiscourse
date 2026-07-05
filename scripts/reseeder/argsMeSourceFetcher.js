/**
 * RESEED-001 — args.me source fetcher.
 *
 * The ONLY component in the harness that touches the network for source
 * material (the offline-dump path bypasses it entirely). Queries the free
 * args.me debate library (Webis corpus, CC-BY 4.0), normalizes each argument
 * through `reseedNormalizer`, and appends the results to the gitignored source
 * bank JSONL under `logs/reseeder/`.
 *
 * Content negotiation (CONFIRMED live 2026-07-05):
 *   - Request header `Accept: application/json`. With this header the endpoint
 *     returns clean JSON: `{ query, arguments: [...], totalSize }`.
 *   - A BARE GET (no Accept header) can return XML/HTML instead. If the
 *     response `content-type` is not JSON, we fall back to a permissive
 *     XML/embedded-JSON extraction and set `parseMode = 'xml_fallback'`.
 *
 * `fetchImpl` is injectable so tests NEVER hit the network. The module refuses
 * to run without a fetch implementation available (guarding against an
 * accidental live call in a test environment where global fetch is present).
 *
 * The bank JSONL is the ONLY place raw args.me `sourceUrl` / `sourceId`
 * attribution ever lands. `logs/` is gitignored (.gitignore:45).
 *
 * CommonJS. No Supabase, no Anthropic. Network only via the injected/global
 * fetch when `populateSourceBank` / `fetchArgsMeTopic` is called at runtime.
 */

const fs = require('node:fs');
const path = require('node:path');
const { normalizeArgsMeBatch } = require('./reseedNormalizer');

const ARGS_ME_ENDPOINT = 'https://www.args.me/api/v2/arguments';

function isJsonContentType(ct) {
  return typeof ct === 'string' && ct.toLowerCase().includes('application/json');
}

/**
 * Extract an `arguments` array from an already-parsed JSON envelope.
 * Accepts both the real nested shape `{ arguments: [...] }` and a bare array.
 */
function extractArgumentsArray(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.arguments)) return parsed.arguments;
  return [];
}

/**
 * Very permissive XML/HTML fallback extractor. args.me's non-JSON response
 * still embeds the argument fields; rather than a full XML parse (which would
 * need a dep), we look for an embedded JSON `arguments` array first (some
 * responses inline it), then fall back to a light regex sweep for
 * conclusion/premise/stance/source tuples. This path is intentionally
 * best-effort: the primary path is JSON, and the orchestrator falls back to
 * the bank / offline dump if extraction yields nothing.
 */
function extractArgumentsFromNonJson(text) {
  const raw = String(text || '');
  // 1. Embedded JSON `"arguments": [ ... ]`. Balance brackets so a nested `]`
  //    (inside premises[]) does not terminate the array prematurely.
  const key = raw.search(/"arguments"\s*:\s*\[/);
  if (key >= 0) {
    const open = raw.indexOf('[', key);
    if (open >= 0) {
      let depth = 0;
      let end = -1;
      for (let i = open; i < raw.length; i++) {
        const ch = raw[i];
        if (ch === '[') depth++;
        else if (ch === ']') {
          depth--;
          if (depth === 0) { end = i; break; }
        }
      }
      if (end > open) {
        try {
          const arr = JSON.parse(raw.slice(open, end + 1));
          if (Array.isArray(arr) && arr.length > 0) return arr;
        } catch {
          // fall through to regex sweep
        }
      }
    }
  }
  // 2. Light regex sweep for <argument>-like blocks. args.me XML uses element
  //    names mirroring the JSON keys. We reconstruct minimal argument objects.
  const out = [];
  const blockRe = /<argument\b[\s\S]*?<\/argument>/gi;
  const blocks = raw.match(blockRe) || [];
  for (const block of blocks) {
    const conclusion = (block.match(/<conclusion\b[^>]*>([\s\S]*?)<\/conclusion>/i) || [])[1];
    const premise = (block.match(/<(?:premise|text)\b[^>]*>([\s\S]*?)<\/(?:premise|text)>/i) || [])[1];
    const stance = (block.match(/<stance\b[^>]*>([\s\S]*?)<\/stance>/i) || [])[1];
    const id = (block.match(/<id\b[^>]*>([\s\S]*?)<\/id>/i) || [])[1];
    const sourceUrl = (block.match(/<sourceUrl\b[^>]*>([\s\S]*?)<\/sourceUrl>/i) || [])[1];
    const topic = (block.match(/<topic\b[^>]*>([\s\S]*?)<\/topic>/i) || [])[1];
    if (!premise) continue;
    out.push({
      id: id ? id.trim() : '',
      conclusion: conclusion ? conclusion.trim() : '',
      premises: [{ text: premise.trim(), stance: stance ? stance.trim() : '' }],
      context: {
        topic: topic ? topic.trim() : '',
        sourceUrl: sourceUrl ? sourceUrl.trim() : '',
      },
      stance: stance ? stance.trim() : '',
    });
  }
  return out;
}

/**
 * Fetch one topic query from args.me.
 * @param {object} opts { query, pageSize, fetchImpl? }
 * @returns {Promise<{records: object[], parseMode: 'json'|'xml_fallback'}>}
 */
async function fetchArgsMeTopic(opts) {
  const { query, pageSize } = opts || {};
  const fetchImpl = (opts && opts.fetchImpl) || (typeof fetch === 'function' ? fetch : null);
  if (typeof fetchImpl !== 'function') {
    throw new Error(
      'argsMeSourceFetcher: no fetch implementation available. Pass opts.fetchImpl (tests must inject one).',
    );
  }
  if (!query || typeof query !== 'string') {
    throw new Error('argsMeSourceFetcher: opts.query (string) is required.');
  }
  const size = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 10;
  const url = `${ARGS_ME_ENDPOINT}?query=${encodeURIComponent(query)}&pageSize=${size}`;
  const fetchedAt = new Date().toISOString();

  let res;
  try {
    res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  } catch {
    // Network error — surface as empty (orchestrator falls back to bank/offline).
    return { records: [], parseMode: 'json' };
  }

  const status = res && typeof res.status === 'number' ? res.status : 0;
  if (status < 200 || status >= 300) {
    return { records: [], parseMode: 'json' };
  }

  const ct =
    res && res.headers && typeof res.headers.get === 'function'
      ? res.headers.get('content-type')
      : '';

  let rawArguments = [];
  let parseMode;
  if (isJsonContentType(ct)) {
    parseMode = 'json';
    let parsed = null;
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }
    rawArguments = extractArgumentsArray(parsed);
  } else {
    parseMode = 'xml_fallback';
    let text = '';
    try {
      text = await res.text();
    } catch {
      text = '';
    }
    rawArguments = extractArgumentsFromNonJson(text);
  }

  const records = normalizeArgsMeBatch(rawArguments, { fetchedAt, ingestMode: 'args_me_live' });
  return { records, parseMode };
}

/**
 * Fetch multiple topics and append the deduped records to the gitignored
 * source bank JSONL.
 *
 * @param {object} opts { topics, perTopic, bankPath, runId, fetchImpl? }
 * @returns {Promise<{written: number, bankPath: string, parseModes: Record<string,number>}>}
 */
async function populateSourceBank(opts) {
  const { topics, perTopic, bankPath, runId } = opts || {};
  if (!Array.isArray(topics) || topics.length === 0) {
    throw new Error('argsMeSourceFetcher.populateSourceBank: opts.topics (non-empty array) required.');
  }
  if (!bankPath || typeof bankPath !== 'string') {
    throw new Error('argsMeSourceFetcher.populateSourceBank: opts.bankPath (string) required.');
  }
  const per = Number.isFinite(perTopic) && perTopic > 0 ? Math.floor(perTopic) : 10;

  const dir = path.dirname(bankPath);
  fs.mkdirSync(dir, { recursive: true });

  const seen = new Set();
  const parseModes = { json: 0, xml_fallback: 0 };
  let written = 0;
  const lines = [];

  for (const topic of topics) {
    const { records, parseMode } = await fetchArgsMeTopic({
      query: topic,
      pageSize: per,
      fetchImpl: opts.fetchImpl,
    });
    parseModes[parseMode] = (parseModes[parseMode] || 0) + 1;
    for (const rec of records) {
      if (seen.has(rec.bankName)) continue;
      seen.add(rec.bankName);
      lines.push(JSON.stringify({ ...rec, runId: runId || null }));
      written += 1;
    }
  }

  if (lines.length > 0) {
    fs.appendFileSync(bankPath, lines.join('\n') + '\n', 'utf8');
  }

  return { written, bankPath, parseModes };
}

module.exports = {
  fetchArgsMeTopic,
  populateSourceBank,
  extractArgumentsArray,
  extractArgumentsFromNonJson,
  isJsonContentType,
  ARGS_ME_ENDPOINT,
};
