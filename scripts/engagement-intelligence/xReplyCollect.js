#!/usr/bin/env node
/**
 * Reply collector — for each root post in a redacted news-story file, fetch
 * up to N top replies via the recent search endpoint with
 * `conversation_id:<id>`. DEFAULT MODE IS DRY.
 *
 * Live mode requires the same env flags as xNewsCollect.
 */
const fs = require('node:fs');
const path = require('node:path');
const { loadEngagementEnv, snapshotForLog } = require('./loadEngagementEnv');

function parseArgs(argv) {
  const args = { dry: true, pilot: false, storiesFile: null };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--dry') args.dry = true;
    else if (a === '--pilot') { args.pilot = true; args.dry = false; }
    else if (a === '--stories' && rest[i + 1]) args.storiesFile = rest[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const env = loadEngagementEnv();

  if (!args.pilot) {
    console.log('[x-reply-collect] dry mode — no X API calls');
    console.log('[x-reply-collect] env: ' + JSON.stringify(snapshotForLog(env)));
    console.log('[x-reply-collect] would fetch up to ' + env.topRepliesPerPost + ' replies per selected root post');
    console.log('[x-reply-collect] hard ceiling: ' + env.maxTotalReplyPairs + ' total reply pairs');
    return;
  }

  if (!env.enableXApi) { console.error('[x-reply-collect] refusing live run: ENGAGEMENT_INTEL_ENABLE_X_API=false'); process.exit(2); }
  if (!env.hasXBearer) { console.error('[x-reply-collect] refusing live run: X_BEARER_TOKEN missing'); process.exit(2); }

  if (!args.storiesFile || !fs.existsSync(args.storiesFile)) {
    console.error('[x-reply-collect] live run requires --stories <path>; got: ' + (args.storiesFile || '(none)'));
    process.exit(2);
  }

  // Live path is intentionally NOT implemented as a full pipeline yet — this
  // stage is the scaffold only. A future stage (6.1.3.3) wires the full
  // conversation_id search loop, with explicit operator approval.
  console.warn('[x-reply-collect] live reply collection not implemented in 6.1.3.2; this is scaffold only');
  console.warn('[x-reply-collect] stories file: ' + path.resolve(args.storiesFile));
  console.warn('[x-reply-collect] env: ' + JSON.stringify(snapshotForLog(env)));
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => { console.error('[x-reply-collect][fatal]', err.message); process.exit(99); });
}

module.exports = { parseArgs };
