/**
 * Stage 6.1.9 — xAI X Search client (thin, gated).
 *
 * Ergonomic wrapper around the existing `xaiAdversarialProvider` + reply
 * collector. Exposes:
 *
 *   - `searchPosts({ topicHint, count, pilot, fromDate, toDate, allowedHandles, excludedHandles, runSalt })`
 *       → { provider, model, candidates: NormalizedSourcePost[] }
 *
 *   - `searchReplies({ source, count, pilot, runSalt })`
 *       → { provider, model, replies: NormalizedReply[] }
 *
 * Hard gates (delegated to the provider layer):
 *   - `.env.engagement-intelligence` present
 *   - `ENGAGEMENT_INTEL_ENABLE_XAI=true`
 *   - `XAI_API_KEY` non-empty
 *   - `--pilot` set
 *
 * Live mode calls `POST https://api.x.ai/v1/responses` with the official
 * `x_search` built-in tool, per the current xAI X Search docs. Filters
 * (allowed_x_handles / excluded_x_handles / from_date / to_date) are passed
 * INSIDE the tool entry, not at the top level.
 *
 * No key / Bearer / Authorization / raw response body is ever logged. The
 * `X_BEARER_TOKEN` env var is NOT required for this path — XAI_API_KEY is
 * sufficient for the xAI X Search tool. Any older official-X-API code lives
 * under a separate gate.
 */
const { collectSourceCandidates } = require('./xaiAdversarialSourceCollector');
const { collectReplyCandidates } = require('./xaiReplyCollector');
const { envSnapshot, XaiAdversarialProviderDisabled } = require('./xaiAdversarialProvider');

class XaiXSearchClientDisabled extends Error {
  constructor(reason) {
    super(`XaiXSearchClientDisabled: ${reason}. Required: .env.engagement-intelligence + ENGAGEMENT_INTEL_ENABLE_XAI=true + XAI_API_KEY + --pilot.`);
    this.name = 'XaiXSearchClientDisabled';
    this.reason = reason;
  }
}

function assertLiveAllowed({ pilot }) {
  const snap = envSnapshot();
  if (!snap.fileExists) throw new XaiXSearchClientDisabled('env_file_missing');
  if (!snap.enableXai) throw new XaiXSearchClientDisabled('env_flag_off');
  if (!snap.hasXaiKey) throw new XaiXSearchClientDisabled('api_key_missing');
  if (!pilot) throw new XaiXSearchClientDisabled('no_pilot_flag');
  return snap;
}

/**
 * Search public X posts for the given topic hint via xAI Responses + x_search.
 * Filters are passed through to the tool. Output is fully redacted.
 */
async function searchPosts({
  topicHint,
  count,
  pilot,
  fromDate,
  toDate,
  allowedHandles,
  excludedHandles,
  fetchImpl,
  timeoutMs,
  runSalt,
} = {}) {
  if (!pilot) throw new XaiXSearchClientDisabled('no_pilot_flag');
  assertLiveAllowed({ pilot });
  try {
    const result = await collectSourceCandidates({
      topicHint,
      count,
      pilot,
      providerLabel: 'xai_responses',
      fetchImpl,
      timeoutMs,
      runSalt,
      // x_search tool filters — passed through to provider when supported.
      fromDate,
      toDate,
      allowedHandles,
      excludedHandles,
    });
    return result;
  } catch (err) {
    if (err instanceof XaiAdversarialProviderDisabled) {
      throw new XaiXSearchClientDisabled(err.reason || 'provider_disabled');
    }
    throw err;
  }
}

/**
 * Search replies / thread-like responses for a given source post via the
 * Responses + x_search path. Output is fully redacted.
 */
async function searchReplies({
  source,
  count,
  pilot,
  fetchImpl,
  timeoutMs,
  runSalt,
} = {}) {
  if (!pilot) throw new XaiXSearchClientDisabled('no_pilot_flag');
  if (!source || !source.sourceClaimSummary) throw new Error('searchReplies requires a source object');
  assertLiveAllowed({ pilot });
  try {
    const result = await collectReplyCandidates({
      source,
      count,
      pilot,
      providerLabel: 'xai_responses',
      fetchImpl,
      timeoutMs,
      runSalt,
    });
    return result;
  } catch (err) {
    if (err instanceof XaiAdversarialProviderDisabled) {
      throw new XaiXSearchClientDisabled(err.reason || 'provider_disabled');
    }
    throw err;
  }
}

module.exports = {
  searchPosts,
  searchReplies,
  XaiXSearchClientDisabled,
  assertLiveAllowed,
};
