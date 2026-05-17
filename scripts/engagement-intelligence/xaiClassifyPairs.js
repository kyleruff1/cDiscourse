#!/usr/bin/env node
/**
 * xAI structured classifier CLI — DISABLED BY DEFAULT.
 *
 * Refuses to issue any HTTP call unless:
 *   - ENGAGEMENT_INTEL_ENABLE_XAI=true in .env.engagement-intelligence
 *   - XAI_API_KEY populated
 *   - operator passes --pilot
 *
 * The prompt + JSON schema + validator live in
 * `src/features/engagementIntelligence/xaiStanceClassifier.ts`. This script is
 * the runtime shell that actually calls xAI when explicitly authorized.
 */
const { loadEngagementEnv, snapshotForLog } = require('./loadEngagementEnv');

function parseArgs(argv) {
  const args = { pilot: false };
  for (const a of argv.slice(2)) if (a === '--pilot') args.pilot = true;
  return args;
}

function disabled(reason) {
  console.log(`[xai-classify] disabled (${reason}). No HTTP call made.`);
  return { enabled: false, disabledReason: reason, output: null };
}

async function main() {
  const args = parseArgs(process.argv);
  const env = loadEngagementEnv();
  console.log('[xai-classify] env snapshot: ' + JSON.stringify(snapshotForLog(env)));
  if (!env.enableXai) { disabled('env_flag_off'); process.exit(0); }
  if (!env.hasXaiKey) { disabled('api_key_missing'); process.exit(0); }
  if (!args.pilot) { disabled('no_pilot_flag'); process.exit(0); }

  // Live xAI call path is intentionally NOT implemented in 6.1.3.2.
  // A future stage (6.1.3.4) wires the real HTTP call against xAI's
  // structured-output API only after a tiny X pilot has produced
  // redacted local samples worth classifying.
  console.warn('[xai-classify] live xAI classification is scaffold-only in 6.1.3.2');
  console.warn('[xai-classify] no HTTP call will be made in this run');
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => { console.error('[xai-classify][fatal]', err.message); process.exit(99); });
}

module.exports = { parseArgs, disabled };
