/**
 * RESEED-001 — args.me argument normalizer.
 *
 * Pure function. Turns one raw args.me argument object into a
 * `ReseedSourceRecord` (see the design doc, "Source-bank record"). Shared by
 * both the live fetcher (`argsMeSourceFetcher.js`) and the offline-dump
 * ingester (`reseedOfflineIngest.js`) so both paths produce byte-identical
 * bank shapes.
 *
 * CONFIRMED live args.me JSON shape (curl -H 'Accept: application/json'
 * 'https://www.args.me/api/v2/arguments?query=school%20uniforms&pageSize=2',
 * captured 2026-07-05):
 *
 *   {
 *     query: {...},
 *     arguments: [
 *       {
 *         id: "Scf842d4b-A5a3cc727",
 *         conclusion: "school uniforms",
 *         premises: [ { text: "...", stance: "PRO", annotations: [...] } ],
 *         context: {
 *           topic: "Nuclear Energy",
 *           sourceDomain: "<source-host>",
 *           sourceId: "Sb4dd79ec",
 *           sourceTitle: "Debate: ... | <source-host>",
 *           sourceUrl: "<scraped source page URL — gitignored-only>"
 *         },
 *         stance: "PRO"
 *       }
 *     ],
 *     totalSize: N
 *   }
 *
 * Notes on the real shape:
 *   - `arguments` is nested under a top-level wrapper, NOT a bare array.
 *   - `premises[].stance` exists ("PRO" | "CON"); a top-level `argument.stance`
 *     also exists. We prefer the premise stance, fall back to argument stance.
 *   - `sourceUrl` / `sourceId` / `sourceDomain` live under `argument.context`,
 *     NOT top-level on the argument. These are LICENSE-attribution fields and
 *     only ever land in the gitignored bank — never a committed file.
 *
 * The normalizer is defensive: it tolerates the older / bare shapes too
 * (top-level `sourceUrl`, missing `context`, missing `premises[].stance`).
 *
 * CommonJS / pure. No network, no Supabase, no Anthropic.
 */

const CC_BY_4_0 = 'CC-BY-4.0';

function mapStance(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (s === 'PRO') return 'PRO';
  if (s === 'CON') return 'CON';
  return 'UNKNOWN';
}

function firstNonEmptyPremise(premises) {
  if (!Array.isArray(premises)) return null;
  for (const p of premises) {
    if (!p || typeof p !== 'object') continue;
    const text = typeof p.text === 'string' ? p.text.trim() : '';
    if (text.length > 0) return p;
  }
  return null;
}

/**
 * Deterministic dedupe key: `<topic-slug>::<sourceDomain>::<shortId>`.
 * Never contains a raw URL. Stable across runs for the same source argument.
 */
function buildBankName(topic, sourceDomain, sourceId, argId) {
  const slug = String(topic || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'untitled';
  const domain = String(sourceDomain || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '')
    .slice(0, 24) || 'unknown';
  const idSource = String(sourceId || argId || 'anon');
  // Short, stable id fragment (last 8 alnum chars of the id).
  const idFrag = idSource.replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'anon';
  return `${slug}::${domain}::${idFrag}`;
}

/**
 * Normalize one raw args.me argument.
 * @returns {object|null} ReseedSourceRecord, or null on malformed/empty premise.
 */
function normalizeArgsMeArgument(raw, ctx) {
  if (!raw || typeof raw !== 'object') return null;
  const fetchedAt = (ctx && ctx.fetchedAt) || new Date().toISOString();
  const ingestMode = (ctx && ctx.ingestMode) || 'args_me_live';

  const conclusion = typeof raw.conclusion === 'string' ? raw.conclusion.trim() : '';
  const context = raw.context && typeof raw.context === 'object' ? raw.context : {};

  const premise = firstNonEmptyPremise(raw.premises);
  if (!premise) return null; // no usable body material → drop (never post a 0-char body)
  const premiseText = premise.text.trim();

  // topic: prefer context.topic, then conclusion.
  const topic = (typeof context.topic === 'string' && context.topic.trim()) || conclusion;
  if (!topic) return null;

  const stance = mapStance(premise.stance || raw.stance);

  // Attribution fields (GITIGNORED-ONLY): context first, then legacy top-level.
  const sourceUrl =
    (typeof context.sourceUrl === 'string' && context.sourceUrl.trim()) ||
    (typeof raw.sourceUrl === 'string' && raw.sourceUrl.trim()) ||
    null;
  const sourceDomain =
    (typeof context.sourceDomain === 'string' && context.sourceDomain.trim()) ||
    (typeof raw.sourceDomain === 'string' && raw.sourceDomain.trim()) ||
    '';
  const sourceId =
    (typeof context.sourceId === 'string' && context.sourceId.trim()) ||
    (typeof raw.sourceId === 'string' && raw.sourceId.trim()) ||
    (typeof raw.id === 'string' ? raw.id.trim() : '') ||
    '';

  const argId = typeof raw.id === 'string' ? raw.id.trim() : '';

  return {
    bankName: buildBankName(topic, sourceDomain, sourceId, argId),
    topic,
    stance,
    premise: premiseText,
    conclusion: conclusion || topic,
    sourceUrl, // GITIGNORED ONLY
    license: CC_BY_4_0,
    sourceId, // GITIGNORED ONLY
    fetchedAt,
    ingestMode,
  };
}

/**
 * Normalize a batch. Drops nulls (malformed/empty), preserves order, and
 * de-duplicates by bankName (first occurrence wins).
 */
function normalizeArgsMeBatch(raws, ctx) {
  const out = [];
  const seen = new Set();
  if (!Array.isArray(raws)) return out;
  for (const raw of raws) {
    const rec = normalizeArgsMeArgument(raw, ctx);
    if (!rec) continue;
    if (seen.has(rec.bankName)) continue;
    seen.add(rec.bankName);
    out.push(rec);
  }
  return out;
}

module.exports = {
  normalizeArgsMeArgument,
  normalizeArgsMeBatch,
  buildBankName,
  mapStance,
  CC_BY_4_0,
};
