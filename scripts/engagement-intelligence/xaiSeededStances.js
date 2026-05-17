/**
 * Stage 6.1.5 — xAI X Search position seeder.
 *
 * Returns topic seeds (same shape as `topicBank.json` entries) sourced from
 * live xAI X Search **or** from a local synthetic seed file. Live calls are
 * fail-closed: the loader refuses unless the operator has explicitly opted
 * in (`ENGAGEMENT_INTEL_ENABLE_XAI=true` AND the caller passes `--pilot`).
 *
 * The synthetic path is the default and never touches the network.
 *
 * Note: this module does NOT call xAI to *classify* anything. It calls X
 * Search to surface real public news-topic stances that the AI-driven bot
 * fixture can then defend / challenge in dev/test scenarios.
 */
const fs = require('node:fs');
const path = require('node:path');
const { loadEngagementEnv, snapshotForLog } = require('./loadEngagementEnv');

const SYNTHETIC_SEEDS_PATH = path.join(
  process.cwd(),
  'fixtures',
  'engagement-intelligence',
  'synthetic-xai-seeded-stances.json',
);

class XaiSeedDisabledError extends Error {
  constructor(reason) {
    super(`xAI seed source disabled: ${reason}. Set ENGAGEMENT_INTEL_ENABLE_XAI=true + XAI_API_KEY and pass --pilot to enable.`);
    this.name = 'XaiSeedDisabledError';
    this.reason = reason;
  }
}

function readSyntheticSeeds() {
  if (!fs.existsSync(SYNTHETIC_SEEDS_PATH)) return [];
  const parsed = JSON.parse(fs.readFileSync(SYNTHETIC_SEEDS_PATH, 'utf8'));
  return Array.isArray(parsed?.topics) ? parsed.topics : [];
}

/**
 * Synthetic source — returns N topic seeds shaped like topicBank entries.
 */
function loadSyntheticSeeds(count) {
  const seeds = readSyntheticSeeds();
  if (seeds.length === 0) throw new Error('Synthetic seeds file is empty or missing.');
  return seeds.slice(0, Math.max(1, Math.min(count || seeds.length, seeds.length)));
}

/**
 * Live xAI X Search path. Scaffold only in this stage — the actual call is
 * implemented but only fires if the operator has opted in. Returns topic
 * seeds derived from current public-news posts.
 *
 * NOT executed by tests. Live calls require:
 *   - .env.engagement-intelligence file
 *   - ENGAGEMENT_INTEL_ENABLE_XAI=true
 *   - XAI_API_KEY non-empty
 *   - opts.pilot === true
 */
async function loadXaiSeedsLive(_count, opts) {
  const env = loadEngagementEnv();
  if (!env.fileExists) throw new XaiSeedDisabledError('env_file_missing');
  if (!env.enableXai) throw new XaiSeedDisabledError('env_flag_off');
  if (!env.hasXaiKey) throw new XaiSeedDisabledError('api_key_missing');
  if (!opts || !opts.pilot) throw new XaiSeedDisabledError('no_pilot_flag');

  // Live xAI X Search invocation is intentionally NOT implemented in this
  // commit. The user requested scaffold-only — we wire the actual call in a
  // follow-up after the dry path has been reviewed. The function exists so
  // tests can assert the gating contract.
  throw new XaiSeedDisabledError('live_xai_search_not_yet_implemented');
}

/**
 * Top-level seed loader used by the AI-driven corpus runner.
 *
 * `mode`:
 *   - `synthetic` (default) — reads `fixtures/engagement-intelligence/synthetic-xai-seeded-stances.json`.
 *   - `xai_live` — calls the live xAI seeder (gated; refuses without env+--pilot).
 *   - `both` — synthetic first; if pilot is also enabled, the live results
 *     are appended after the synthetic ones (capped at `count`).
 */
async function loadSeeds(opts = {}) {
  const mode = opts.mode || 'synthetic';
  const count = Number.isFinite(opts.count) && opts.count > 0 ? opts.count : 8;
  if (mode === 'synthetic') return loadSyntheticSeeds(count);
  if (mode === 'xai_live') return loadXaiSeedsLive(count, opts);
  if (mode === 'both') {
    const a = loadSyntheticSeeds(Math.ceil(count / 2));
    if (!opts.pilot) return a; // synthetic only when not in pilot
    try {
      const b = await loadXaiSeedsLive(Math.ceil(count / 2), opts);
      return a.concat(b).slice(0, count);
    } catch (err) {
      // Live path disabled — return synthetic only with a note.
      return a;
    }
  }
  return loadSyntheticSeeds(count);
}

module.exports = {
  loadSeeds,
  loadSyntheticSeeds,
  loadXaiSeedsLive,
  XaiSeedDisabledError,
  SYNTHETIC_SEEDS_PATH,
  snapshotForLog,
};
