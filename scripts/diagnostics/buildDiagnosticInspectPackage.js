#!/usr/bin/env node
/**
 * CDiscourse diagnostic-inspect package builder.
 *
 * Stages on-disk telemetry + redacted reports + safe code-state metadata
 * into `artifacts/diagnostics/<timestamp>-cdiscourse-diagnostic-inspect/`,
 * runs a final safety scan, and (if clean) produces a ZIP next to it.
 *
 * Skill: `.claude/skills/diagnostic-inspect-package-operator/SKILL.md`.
 * That file owns the hard rules; this script implements them.
 *
 * - No network. No Supabase write. No service-role. No xAI / Anthropic call.
 * - When `--include-db` is passed AND `.env` has anon-key creds, a small
 *   read-only snapshot is added via the existing supabase client. The
 *   snapshot path is gated; failures degrade to "omitted with reason".
 * - Safety scan is mandatory. Failure writes FAILED_SAFETY_SCAN.txt and
 *   exits non-zero. No secret VALUE is ever printed or written.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');

const REPO_ROOT = process.cwd();
const DEFAULT_OUT_ROOT = path.join(REPO_ROOT, 'artifacts', 'diagnostics');

// ── CLI parsing ───────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    dry: false,
    includeDb: false,
    includeAllReports: false,
    includeAllJsonl: false,
    outDir: DEFAULT_OUT_ROOT,
    timestamp: nowStamp(),
    jsonlPerDirLimit: 5,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') args.dry = true;
    else if (a === '--include-db') args.includeDb = true;
    else if (a === '--include-all-reports') args.includeAllReports = true;
    else if (a === '--include-all-jsonl') args.includeAllJsonl = true;
    else if (a === '--out-dir' && argv[i + 1]) args.outDir = String(argv[++i]);
    else if (a === '--timestamp' && argv[i + 1]) args.timestamp = String(argv[++i]);
    else if (a === '--jsonl-per-dir-limit' && argv[i + 1]) args.jsonlPerDirLimit = Math.max(1, Number(argv[++i]) || 5);
  }
  return args;
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function exists(p) { try { fs.statSync(p); return true; } catch { return false; } }
function readText(p) { return fs.readFileSync(p, 'utf8'); }
function writeText(p, t) { ensureDir(path.dirname(p)); fs.writeFileSync(p, t); }
function shortHash(text) { return createHash('sha256').update(String(text || '')).digest('hex').slice(0, 16); }

// ── Safety scan (regex set) ──────────────────────────────────

// Pattern thresholds tuned to catch real secret / identifier shapes while
// excluding incidental file-name / doc-name matches. Real xAI keys are
// ~80 base64-like chars after `xai-`; filenames like `xai-adversarial-
// thread-corpus.jsonl` top out around 36 chars and contain hyphenated
// English words. Threshold 32+ rejects filenames cleanly.
const SAFETY_PATTERNS = [
  // Secret shapes
  { name: 'anthropic_api_key_env', re: /^\s*ANTHROPIC_API_KEY\s*=\s*\S/m },
  { name: 'xai_api_key_env', re: /^\s*XAI_API_KEY\s*=\s*\S/m },
  { name: 'x_bearer_token_env', re: /^\s*X_BEARER_TOKEN\s*=\s*\S/m },
  { name: 'supabase_service_role_key_env', re: /^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S/m },
  { name: 'supabase_secret_key_shape', re: /sb_secret_[A-Za-z0-9]{12,}/ },
  { name: 'anthropic_key_shape', re: /sk-ant-[A-Za-z0-9_-]{32,}/ },
  { name: 'xai_key_shape', re: /xai-[A-Za-z0-9]{32,}/ },
  { name: 'jwt_shape', re: /eyJ[A-Za-z0-9_-]{40,}/ },
  { name: 'bearer_token', re: /Bearer\s+[A-Za-z0-9._-]{20,}/ },
  // Tempered greedy token: match `Authorization:` then 12+ chars of any
  // non-newline EXCEPT chars that begin the literal `[redacted]` placeholder.
  // This way `Authorization: [redacted] safe prose` does NOT match while
  // `Authorization: Bearer <real>` does.
  { name: 'authorization_header', re: /Authorization\s*:\s*(?:(?!\[redacted\])[^\n]){12,}/i },
  // Identifiers
  // X handle: @ NOT preceded by an alphanumeric (so it's not the middle of
  // an email like noreply@anthropic.com), NOT followed by a .TLD suffix.
  { name: 'x_handle', re: /(?<![A-Za-z0-9_.])@([A-Za-z0-9_]{3,15})(?![\w-]*\.[A-Za-z]{2,})/ },
  { name: 'x_url', re: /https?:\/\/(?:x|twitter)\.com\/[A-Za-z0-9_/]+/i },
  { name: 't_co_url', re: /https?:\/\/t\.co\/[A-Za-z0-9_]+/i },
  // Raw post id: 15-20 contiguous digits NOT inside a longer alphanumeric
  // token (so SHA-prefixes and version numbers don't trip it).
  { name: 'raw_post_id', re: /(?<![A-Za-z0-9])\d{15,20}(?![A-Za-z0-9])/ },
  { name: 'email_like', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
];

const SAFETY_SCAN_BYPASS = new Set([
  // The skill file enumerates the patterns themselves; matching them in the
  // skill body would be a false positive. The skill file is scanned by the
  // skill-gate validator instead.
  '.claude/skills/diagnostic-inspect-package-operator/SKILL.md',
]);

function scanText(text) {
  const hits = [];
  for (const p of SAFETY_PATTERNS) {
    if (p.re.test(text)) hits.push(p.name);
  }
  return hits;
}

// ── JSONL sanitiser (line-by-line redactor) ──────────────────

const REDACT_REPLACERS = [
  // Secrets: only long shapes, not hyphenated filenames.
  [/sk-ant-[A-Za-z0-9_-]{20,}/g, '[redacted-sk-ant]'],
  [/xai-[A-Za-z0-9]{32,}/g, '[redacted-xai]'],
  [/sb_secret_[A-Za-z0-9]{12,}/g, '[redacted-sb-secret]'],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g, '[redacted-jwt]'],
  [/eyJ[A-Za-z0-9_-]{40,}/g, '[redacted-jwt]'],
  [/Bearer\s+\S+/gi, 'Bearer [redacted]'],
  // Capture `Authorization: Bearer <…>` AND `Authorization: <…>` in one go
  // so a stray `<XAI_API_KEY>` placeholder after `Bearer` cannot leak past
  // the replacer.
  [/Authorization\s*:\s*(?:Bearer\s+)?\S+/gi, 'Authorization: [redacted]'],
  // EMAIL FIRST so the @-handle replacer doesn't bisect "user@example.com".
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email>'],
  // X identifiers
  [/https?:\/\/(?:x|twitter)\.com\/[^\s")\]]+/gi, '<x-link>'],
  [/https?:\/\/t\.co\/[^\s")\]]+/gi, '<x-link>'],
  [/\b(?:x|twitter)\.com\/[^\s")\]]+/gi, '<x-link>'],
  [/\bt\.co\/[^\s")\]]+/gi, '<x-link>'],
  // @handle: NOT preceded by alphanum (so it's not the middle of an email
  // we somehow missed) AND NOT followed by a .TLD.
  [/(?<![A-Za-z0-9_.])@([A-Za-z0-9_]{1,15})\b(?![\w-]*\.[A-Za-z]{2,})/g, '<x-handle>'],
  // 15-20 contiguous digits NOT inside a longer alphanumeric token.
  [/(?<![A-Za-z0-9])\d{15,20}(?![A-Za-z0-9])/g, '<x-id>'],
];

function sanitiseLine(line) {
  let s = String(line || '');
  for (const [re, sub] of REDACT_REPLACERS) s = s.replace(re, sub);
  return s;
}

function sanitiseFile(srcPath, dstPath) {
  const lines = readText(srcPath).split('\n');
  const out = lines.map(sanitiseLine).join('\n');
  writeText(dstPath, out);
}

// ── Code-state collection (safe metadata only) ──────────────

function gitCmd(args) {
  try {
    const r = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', shell: false });
    if (r.status === 0) return r.stdout.trim();
    return '';
  } catch { return ''; }
}

function collectCodeState() {
  const branch = gitCmd(['rev-parse', '--abbrev-ref', 'HEAD']);
  const lastCommit = gitCmd(['log', '-1', '--pretty=format:%h %s%n%an%n%ad']);
  // git status -sb is summarised, not raw diff.
  const workingTree = gitCmd(['status', '-sb']);
  return { branch, lastCommit, workingTree };
}

function collectSkillHashes() {
  const skillsDir = path.join(REPO_ROOT, '.claude', 'skills');
  if (!exists(skillsDir)) return [];
  const entries = fs.readdirSync(skillsDir);
  const out = [];
  for (const e of entries) {
    const skillFile = path.join(skillsDir, e, 'SKILL.md');
    if (!exists(skillFile)) continue;
    const text = readText(skillFile);
    out.push({
      name: e,
      path: path.relative(REPO_ROOT, skillFile).replace(/\\/g, '/'),
      hash: shortHash(text),
      bytes: Buffer.byteLength(text, 'utf8'),
    });
  }
  return out;
}

function collectPackageScripts() {
  const pkgPath = path.join(REPO_ROOT, 'package.json');
  if (!exists(pkgPath)) return {};
  try {
    const pkg = JSON.parse(readText(pkgPath));
    return pkg.scripts || {};
  } catch { return {}; }
}

// ── File selection ──────────────────────────────────────────

function listFilesInDir(dir, predicate) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => predicate ? predicate(f) : true)
    .map((f) => ({ name: f, path: path.join(dir, f), mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
}

function selectJsonl(dir, all, perDirLimit) {
  const files = listFilesInDir(dir, (f) => f.endsWith('.jsonl'));
  return all ? files : files.slice(0, perDirLimit);
}

function selectReports(dir, all) {
  const files = listFilesInDir(dir, (f) => f.endsWith('.md'));
  if (all) return files;
  // Default: only the most recent per family. Family = base name without dates.
  const byFamily = new Map();
  for (const f of files) {
    const family = f.name.replace(/^\d{4}-\d{2}-\d{2}-?/, '').replace(/\.md$/i, '');
    if (!byFamily.has(family)) byFamily.set(family, f);
  }
  return [...byFamily.values()];
}

// ── Corpus event index + metrics ────────────────────────────

function parseJsonlSafe(filePath) {
  try {
    return readText(filePath).split('\n').filter(Boolean).map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}

function buildCorpusEventIndex(jsonlPaths) {
  const index = {};
  for (const fp of jsonlPaths) {
    const events = parseJsonlSafe(fp);
    if (events.length === 0) continue;
    const file = path.relative(REPO_ROOT, fp).replace(/\\/g, '/');
    const byStage = {};
    let runId = null;
    for (const e of events) {
      if (!runId && typeof e.runId === 'string') runId = e.runId;
      const s = e.stage || 'unknown';
      byStage[s] = (byStage[s] || 0) + 1;
    }
    index[file] = { runId, eventCount: events.length, byStage };
  }
  return index;
}

function buildCorpusMetrics(jsonlPaths) {
  const metrics = {
    totalSources: 0,
    repliesScanned: 0,
    usableDissent: 0,
    syntheticFallback: 0,
    scenarios: 0,
    rooms: 0,
    movesAttempted: 0,
    movesPosted: 0,
    movesRejected: 0,
    movesSkipped: 0,
    topChosenAxis: {},
    topSubmittedAxis: {},
    topFallbackAxis: {},
    mechanismCoverage: { withMechanism: 0, withoutMechanism: 0 },
    jsonParsedCoverage: { yes: 0, no: 0 },
    validationFailureReasons: {},
    submitRejectionReasons: {},
    stopReasons: {},
    annotationSources: {},
    missingEventStages: {},
    runIds: [],
  };
  const requiredStages = [
    'skill_validation', 'run_start', 'source_harvest', 'dissent_detection',
    'scenario_build', 'bot_assignment', 'move_prompt_built', 'move_rendered',
    'move_validated', 'bot_move_render', 'submit_attempt', 'submit_result',
    'annotation', 'room_summary', 'run_summary',
  ];
  for (const fp of jsonlPaths) {
    const events = parseJsonlSafe(fp);
    if (events.length === 0) continue;
    const seen = new Set();
    let runId = null;
    for (const e of events) {
      seen.add(e.stage);
      if (!runId && e.runId) runId = e.runId;
      switch (e.stage) {
        case 'source_harvest':
          if (e.sourceHash) metrics.totalSources += 1;
          break;
        case 'reply_harvest':
          if (typeof e.repliesReturned === 'number') metrics.repliesScanned += e.repliesReturned;
          break;
        case 'dissent_detection':
          metrics.repliesScanned += 1;
          if (e.classification && e.classification.usableForBotDebate) metrics.usableDissent += 1;
          break;
        case 'synthetic_rebuttal_generated':
          metrics.syntheticFallback += 1;
          break;
        case 'scenario_build':
          metrics.scenarios += 1;
          break;
        case 'submit_attempt':
          if (e.attempted) metrics.movesAttempted += 1;
          break;
        case 'submit_result':
          if (e.status === 'posted') metrics.movesPosted += 1;
          else if (e.status === 'rejected') {
            metrics.movesRejected += 1;
            const k = `http_${e.httpStatus || '?'}_${e.errorCode || 'unknown'}`;
            metrics.submitRejectionReasons[k] = (metrics.submitRejectionReasons[k] || 0) + 1;
          } else if (e.status === 'skipped') {
            metrics.movesSkipped += 1;
          }
          break;
        case 'bot_move_render': {
          const gs = e.generationSpec || {};
          if (gs.chosenAxis) metrics.topChosenAxis[gs.chosenAxis] = (metrics.topChosenAxis[gs.chosenAxis] || 0) + 1;
          if (e.move && e.move.disagreementAxis) metrics.topSubmittedAxis[e.move.disagreementAxis] = (metrics.topSubmittedAxis[e.move.disagreementAxis] || 0) + 1;
          if (gs.fallbackAxisUsed) metrics.topFallbackAxis[gs.chosenAxis || 'unknown'] = (metrics.topFallbackAxis[gs.chosenAxis || 'unknown'] || 0) + 1;
          if (gs.mechanism) metrics.mechanismCoverage.withMechanism += 1;
          else metrics.mechanismCoverage.withoutMechanism += 1;
          if (gs.jsonParsed) metrics.jsonParsedCoverage.yes += 1;
          else metrics.jsonParsedCoverage.no += 1;
          if (gs.validationFailureReason) {
            const k = String(gs.validationFailureReason).slice(0, 80);
            metrics.validationFailureReasons[k] = (metrics.validationFailureReasons[k] || 0) + 1;
          }
          break;
        }
        case 'room_summary':
          metrics.rooms += 1;
          if (e.stopReason) metrics.stopReasons[e.stopReason] = (metrics.stopReasons[e.stopReason] || 0) + 1;
          break;
        case 'annotation':
          if (e.annotationSource) metrics.annotationSources[e.annotationSource] = (metrics.annotationSources[e.annotationSource] || 0) + 1;
          break;
        default:
          // ignore
      }
    }
    if (runId && !metrics.runIds.includes(runId)) metrics.runIds.push(runId);
    const missing = requiredStages.filter((s) => !seen.has(s));
    if (missing.length > 0) metrics.missingEventStages[runId || path.basename(fp)] = missing;
  }
  return metrics;
}

function buildSemanticValues(jsonlPaths) {
  const values = {
    issueFrames: {},
    politicalValences: {},
    amplificationRisks: {},
    evidentiaryRisks: {},
    abuseRisks: {},
    sourceChainRisks: {},
    primaryStances: {},
    disagreementTypes: {},
  };
  for (const fp of jsonlPaths) {
    const events = parseJsonlSafe(fp);
    for (const e of events) {
      const c = (e.classification) || (e.annotation) || null;
      if (!c || typeof c !== 'object') continue;
      const incr = (bucket, key) => {
        if (!key) return;
        values[bucket][key] = (values[bucket][key] || 0) + 1;
      };
      incr('issueFrames', c.politicalIssueFrame);
      incr('politicalValences', c.politicalValence);
      incr('amplificationRisks', c.amplificationRisk);
      incr('evidentiaryRisks', c.evidentiaryRisk);
      incr('abuseRisks', c.abuseRisk);
      incr('sourceChainRisks', c.sourceChainRisk);
      incr('primaryStances', c.primaryStance);
      incr('disagreementTypes', c.disagreementType);
    }
  }
  return values;
}

// ── Decision ledger (parsed from recent commits + current-status) ──

function buildDecisionLedger() {
  const lines = [];
  const commits = gitCmd(['log', '-20', '--pretty=format:%h|%ad|%s', '--date=short']).split('\n').filter(Boolean);
  const ledger = { entries: [] };
  for (const line of commits) {
    const parts = line.split('|');
    if (parts.length < 3) continue;
    const [hash, date, subject] = parts;
    ledger.entries.push({ hash, date, subject });
    lines.push(`- \`${hash}\` (${date}) — ${subject}`);
  }
  const status = exists(path.join(REPO_ROOT, 'docs/current-status.md'))
    ? readText(path.join(REPO_ROOT, 'docs/current-status.md')).split('\n').slice(0, 40).join('\n')
    : '';
  const md = [
    '# Decision Ledger',
    '',
    'Recent commits (last 20):',
    '',
    ...lines,
    '',
    '## current-status.md (top of file)',
    '',
    status,
    '',
  ].join('\n');
  return { md, json: ledger };
}

// ── Recommendations ─────────────────────────────────────────

function buildGameChangeRecommendations(metrics) {
  const lines = ['# Game-rule recommendations', '', 'Derived from this run\'s corpus metrics.', ''];
  const topAxes = Object.entries(metrics.topChosenAxis).sort((a, b) => b[1] - a[1]);
  if (topAxes.length > 0) {
    lines.push('## Axis usage');
    lines.push('');
    for (const [k, v] of topAxes.slice(0, 10)) lines.push(`- \`${k}\` — ${v}`);
    lines.push('');
    const rarely = topAxes.filter(([, v]) => v <= 1);
    if (rarely.length > 0) {
      lines.push('### Rarely-chosen axes (review whether prompt is biasing against them)');
      lines.push('');
      for (const [k, v] of rarely) lines.push(`- \`${k}\` — ${v}`);
      lines.push('');
    }
  }
  if (metrics.movesRejected > 0) {
    lines.push('## Rejection patterns');
    lines.push('');
    for (const [k, v] of Object.entries(metrics.submitRejectionReasons).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      lines.push(`- ${v} × \`${k}\``);
    }
    lines.push('');
  }
  if (metrics.mechanismCoverage.withoutMechanism > 0) {
    lines.push(`## Mechanism coverage`);
    lines.push('');
    lines.push(`- with mechanism: ${metrics.mechanismCoverage.withMechanism}`);
    lines.push(`- without mechanism: ${metrics.mechanismCoverage.withoutMechanism}`);
    lines.push('');
    if (metrics.mechanismCoverage.withoutMechanism > metrics.mechanismCoverage.withMechanism / 4) {
      lines.push('- Recommendation: tighten the renderer prompt to make the `mechanism` field required-not-optional.');
      lines.push('');
    }
  }
  return lines.join('\n');
}

function buildUxPlayabilityRecommendations(metrics) {
  const lines = ['# UX / Playability recommendations', '', 'Derived from rejection + validation patterns.', ''];
  if (metrics.movesRejected > 0) {
    const topicSatHits = Object.keys(metrics.submitRejectionReasons).filter((k) => /topic_satisfaction/.test(k));
    if (topicSatHits.length > 0) {
      lines.push('## Deployed Edge Function still hard-blocking on `topic_satisfaction_lexical`');
      lines.push('');
      lines.push('- Action: `npx supabase functions deploy submit-argument`. The local shared mirror already treats OFF_TOPIC as advisory; the deployed function may be lagging.');
      lines.push('');
    }
  }
  if (Object.keys(metrics.validationFailureReasons).length > 0) {
    lines.push('## Validation failure reasons (renderer side)');
    lines.push('');
    for (const [k, v] of Object.entries(metrics.validationFailureReasons).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      lines.push(`- ${v} × ${k}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// ── README + MANIFEST + summary ─────────────────────────────

function buildReadme(meta) {
  return [
    '# CDiscourse diagnostic inspect package',
    '',
    `_Built: ${meta.timestamp}_`,
    `_Branch: ${meta.codeState.branch || 'unknown'}_`,
    `_Last commit: ${(meta.codeState.lastCommit || '').split('\n')[0] || 'unknown'}_`,
    '',
    '## What this is',
    '',
    'A safety-scanned snapshot of CDiscourse run state — JSONL telemetry (sanitised), redacted reports, code-state metadata, skill hashes, derived metrics + recommendations. No secrets. No raw X data. No service-role. No network was used to build it (except an optional read-only Supabase READ if `--include-db` was passed).',
    '',
    '## Contents',
    '',
    '- `MANIFEST.json` — every file with its sha-256 prefix',
    '- `diagnostic-summary.md` — top-line numbers',
    '- `decision-ledger.md` / `.json` — recent operator decisions',
    '- `corpus-event-index.json` — per-runId event-stage histogram',
    '- `corpus-metrics.json` — aggregated metrics',
    '- `semantic-values.json` — distribution of issue-frame / valence / risk fields',
    '- `game-change-recommendations.md`',
    '- `ux-playability-recommendations.md`',
    '- `sanitized-jsonl/` — every staged JSONL run through the redactor',
    '- `redacted-reports/` — copies of `docs/testing-runs/*.md`',
    '- `code-state/` — branch / commit / working-tree / skill hashes / package scripts',
    '- `safety-scan/` — scan-summary.json + scan-passed.txt',
    '- `analysis-scripts/analyze-sanitized-corpus.js` — re-derive metrics from JSONL',
    `${meta.includeDb ? '- `db-snapshot/` — read-only snapshot taken via anon-key Supabase client\n' : ''}`,
    '## Re-running analysis',
    '',
    'From the unzipped folder:',
    '',
    '```',
    'node analysis-scripts/analyze-sanitized-corpus.js',
    '```',
    '',
    '## Safety',
    '',
    'Every file in this package passed the safety scan (see `safety-scan/scan-summary.json`). The scan checks for: secret shapes (Anthropic/xAI/Supabase key prefixes, JWT shape, Bearer tokens, Authorization headers, env-key assignments), X identifiers (handle markers, x.com/twitter.com/t.co URLs, raw 15-20 digit post IDs), and email-like strings. If the scan fails the ZIP is not produced.',
    '',
  ].join('\n');
}

function buildDiagnosticSummary(metrics, eventIndex, meta) {
  const lines = [];
  lines.push('# Diagnostic summary');
  lines.push('');
  lines.push(`_Generated: ${meta.timestamp}_`);
  lines.push('');
  lines.push('## Corpus counts');
  lines.push('');
  lines.push(`- Sources harvested: ${metrics.totalSources}`);
  lines.push(`- Replies scanned: ${metrics.repliesScanned}`);
  lines.push(`- Usable dissent: ${metrics.usableDissent}`);
  lines.push(`- Synthetic fallbacks: ${metrics.syntheticFallback}`);
  lines.push(`- Scenarios built: ${metrics.scenarios}`);
  lines.push(`- Rooms summarised: ${metrics.rooms}`);
  lines.push('');
  lines.push('## Move ledger');
  lines.push('');
  lines.push(`- Attempted: ${metrics.movesAttempted}`);
  lines.push(`- Posted: ${metrics.movesPosted}`);
  lines.push(`- Rejected: ${metrics.movesRejected}`);
  lines.push(`- Skipped (dry): ${metrics.movesSkipped}`);
  lines.push('');
  if (Object.keys(metrics.topChosenAxis).length > 0) {
    lines.push('## Top chosen axes');
    lines.push('');
    for (const [k, v] of Object.entries(metrics.topChosenAxis).sort((a, b) => b[1] - a[1]).slice(0, 8)) lines.push(`- \`${k}\` — ${v}`);
    lines.push('');
  }
  if (Object.keys(metrics.stopReasons).length > 0) {
    lines.push('## Stop reasons');
    lines.push('');
    for (const [k, v] of Object.entries(metrics.stopReasons).sort((a, b) => b[1] - a[1])) lines.push(`- \`${k}\` — ${v}`);
    lines.push('');
  }
  if (Object.keys(metrics.missingEventStages).length > 0) {
    lines.push('## Runs with missing event stages');
    lines.push('');
    for (const [run, missing] of Object.entries(metrics.missingEventStages)) {
      lines.push(`- ${run}: missing ${missing.join(', ')}`);
    }
    lines.push('');
  }
  lines.push('## Files staged');
  lines.push('');
  for (const [file, info] of Object.entries(eventIndex)) {
    lines.push(`- ${file} — runId=\`${info.runId || 'n/a'}\` events=${info.eventCount}`);
  }
  lines.push('');
  return lines.join('\n');
}

function buildAnalysisScript() {
  return `#!/usr/bin/env node
/**
 * analyze-sanitized-corpus.js — re-derive metrics from the bundled
 * sanitized JSONL files. Pure Node, no deps. Run from inside the
 * unzipped diagnostic-inspect package folder.
 */
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '..', 'sanitized-jsonl');
if (!fs.existsSync(dir)) { console.error('sanitized-jsonl/ not found next to this script'); process.exit(1); }
const stages = {};
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.jsonl')) continue;
  const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\\n').filter(Boolean);
  for (const l of lines) {
    let e; try { e = JSON.parse(l); } catch { continue; }
    const s = e.stage || 'unknown';
    stages[s] = (stages[s] || 0) + 1;
  }
}
console.log(JSON.stringify(stages, null, 2));
`;
}

// ── Manifest ────────────────────────────────────────────────

function buildManifest(stagingDir) {
  const out = { generatedAt: new Date().toISOString(), files: [] };
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        const rel = path.relative(stagingDir, full).replace(/\\/g, '/');
        const text = fs.readFileSync(full);
        out.files.push({
          path: rel,
          bytes: text.length,
          sha256_prefix: createHash('sha256').update(text).digest('hex').slice(0, 16),
        });
      }
    }
  }
  walk(stagingDir);
  out.files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return out;
}

// ── DB snapshot (only when --include-db) ────────────────────

async function maybeCollectDbSnapshot(includeDb, dbDir) {
  if (!includeDb) return { included: false, reason: 'not_requested' };
  // Look for anon-key env in `.env`. NEVER use service-role.
  const envPath = path.join(REPO_ROOT, '.env');
  if (!exists(envPath)) return { included: false, reason: 'env_missing' };
  const env = readText(envPath);
  const url = (env.match(/^\s*EXPO_PUBLIC_SUPABASE_URL\s*=\s*(\S+)/m) || [])[1];
  const anonKey = (env.match(/^\s*EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY\s*=\s*(\S+)/m) || [])[1]
                || (env.match(/^\s*EXPO_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(\S+)/m) || [])[1];
  if (!url || !anonKey) return { included: false, reason: 'anon_key_missing' };
  // Refuse if there's any service-role key in the env file — defensive.
  if (/SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S/.test(env)) {
    // Don't fail; just refuse to use it.
  }
  let client;
  try { client = require(path.join(REPO_ROOT, 'node_modules', '@supabase', 'supabase-js')).createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }); }
  catch (err) { return { included: false, reason: `supabase_client_unavailable:${String(err && err.message).slice(0, 80)}` }; }
  ensureDir(dbDir);
  const results = {};
  const tables = ['constitution_versions', 'debates', 'arguments'];
  for (const t of tables) {
    try {
      const { data, error } = await client.from(t).select('*').limit(50);
      if (error) { results[t] = { error: error.message }; continue; }
      // Sanitise rows before writing.
      const sanitized = (data || []).map((row) => {
        const r = { ...row };
        for (const k of Object.keys(r)) {
          if (typeof r[k] === 'string') r[k] = sanitiseLine(r[k]);
        }
        return r;
      });
      writeText(path.join(dbDir, `${t}.json`), JSON.stringify(sanitized, null, 2));
      results[t] = { rows: sanitized.length };
    } catch (err) {
      results[t] = { error: String(err && err.message).slice(0, 80) };
    }
  }
  writeText(path.join(dbDir, '_summary.json'), JSON.stringify(results, null, 2));
  return { included: true, summary: results };
}

// ── ZIP (cross-platform best-effort) ────────────────────────

function tryZip(srcDir, dstZip) {
  // 1. PowerShell Compress-Archive
  try {
    const cmd = `Compress-Archive -Path "${srcDir}\\*" -DestinationPath "${dstZip}" -Force`;
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { stdio: 'pipe' });
    if (exists(dstZip)) return { method: 'powershell.Compress-Archive' };
  } catch { /* try next */ }
  // 2. zip -r
  try {
    execFileSync('zip', ['-r', dstZip, '.'], { cwd: srcDir, stdio: 'pipe' });
    if (exists(dstZip)) return { method: 'zip' };
  } catch { /* try next */ }
  // 3. tar -a -c -f (Windows tar supports ZIP via -a + .zip extension)
  try {
    execFileSync('tar', ['-a', '-c', '-f', dstZip, '-C', srcDir, '.'], { stdio: 'pipe' });
    if (exists(dstZip)) return { method: 'tar' };
  } catch { /* fall through */ }
  return { method: 'staging_only' };
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const baseName = `${args.timestamp}-cdiscourse-diagnostic-inspect`;
  const stagingDir = path.join(args.outDir, baseName);
  const zipPath = path.join(args.outDir, `${baseName}.zip`);

  // Skill gate: read our own SKILL.md.
  const skillPath = path.join(REPO_ROOT, '.claude', 'skills', 'diagnostic-inspect-package-operator', 'SKILL.md');
  if (!exists(skillPath)) {
    console.error('[diagnostic-inspect] SKILL.md missing; refusing to run');
    process.exitCode = 2;
    return;
  }
  const skillText = readText(skillPath);
  const skillHash = shortHash(skillText);

  console.log(`[diagnostic-inspect] mode=${args.dry ? 'dry' : 'live'} includeDb=${args.includeDb}`);
  console.log(`[diagnostic-inspect] staging: ${path.relative(REPO_ROOT, stagingDir)}`);
  console.log(`[diagnostic-inspect] skill hash: ${skillHash}`);

  ensureDir(stagingDir);
  ensureDir(path.join(stagingDir, 'sanitized-jsonl'));
  ensureDir(path.join(stagingDir, 'redacted-reports'));
  ensureDir(path.join(stagingDir, 'code-state'));
  ensureDir(path.join(stagingDir, 'safety-scan'));
  ensureDir(path.join(stagingDir, 'analysis-scripts'));

  // ── Stage JSONL.
  const eiJsonl = selectJsonl(path.join(REPO_ROOT, 'logs', 'engagement-intelligence'), args.includeAllJsonl, args.jsonlPerDirLimit);
  const stressJsonl = selectJsonl(path.join(REPO_ROOT, 'logs', 'bot-stress'), args.includeAllJsonl, args.jsonlPerDirLimit);
  const jsonlPaths = [...eiJsonl, ...stressJsonl].map((f) => f.path);
  for (const fp of jsonlPaths) {
    const dstName = path.basename(fp).replace(/\.jsonl$/, '-sanitized.jsonl');
    sanitiseFile(fp, path.join(stagingDir, 'sanitized-jsonl', dstName));
  }
  console.log(`[diagnostic-inspect] sanitised ${jsonlPaths.length} JSONL file(s)`);

  // ── Stage reports. Apply the redactor on copy so a stray identifier in
  // a committed report can't propagate into the package.
  const reports = selectReports(path.join(REPO_ROOT, 'docs', 'testing-runs'), args.includeAllReports);
  for (const r of reports) {
    sanitiseFile(r.path, path.join(stagingDir, 'redacted-reports', r.name));
  }
  for (const top of ['docs/current-status.md', 'docs/next-prompts.md', 'CLAUDE.md']) {
    const src = path.join(REPO_ROOT, top);
    if (exists(src)) {
      sanitiseFile(src, path.join(stagingDir, 'redacted-reports', path.basename(top)));
    }
  }
  console.log(`[diagnostic-inspect] sanitised ${reports.length} report(s) + 3 top-level docs`);

  // ── Code-state metadata.
  const codeState = collectCodeState();
  const skillHashes = collectSkillHashes();
  const packageScripts = collectPackageScripts();
  writeText(path.join(stagingDir, 'code-state', 'branch.txt'), codeState.branch + '\n');
  writeText(path.join(stagingDir, 'code-state', 'last-commit.txt'), codeState.lastCommit + '\n');
  writeText(path.join(stagingDir, 'code-state', 'working-tree.txt'), codeState.workingTree + '\n');
  writeText(path.join(stagingDir, 'code-state', 'skill-hashes.json'), JSON.stringify(skillHashes, null, 2));
  writeText(path.join(stagingDir, 'code-state', 'package-scripts.json'), JSON.stringify(packageScripts, null, 2));

  // ── Derived artifacts.
  const eventIndex = buildCorpusEventIndex(jsonlPaths);
  writeText(path.join(stagingDir, 'corpus-event-index.json'), JSON.stringify(eventIndex, null, 2));
  const metrics = buildCorpusMetrics(jsonlPaths);
  writeText(path.join(stagingDir, 'corpus-metrics.json'), JSON.stringify(metrics, null, 2));
  const semantic = buildSemanticValues(jsonlPaths);
  writeText(path.join(stagingDir, 'semantic-values.json'), JSON.stringify(semantic, null, 2));
  const ledger = buildDecisionLedger();
  writeText(path.join(stagingDir, 'decision-ledger.md'), ledger.md);
  writeText(path.join(stagingDir, 'decision-ledger.json'), JSON.stringify(ledger.json, null, 2));
  writeText(path.join(stagingDir, 'game-change-recommendations.md'), buildGameChangeRecommendations(metrics));
  writeText(path.join(stagingDir, 'ux-playability-recommendations.md'), buildUxPlayabilityRecommendations(metrics));
  writeText(path.join(stagingDir, 'analysis-scripts', 'analyze-sanitized-corpus.js'), buildAnalysisScript());
  writeText(path.join(stagingDir, 'diagnostic-summary.md'), buildDiagnosticSummary(metrics, eventIndex, {
    timestamp: args.timestamp,
  }));
  writeText(path.join(stagingDir, 'README.md'), buildReadme({
    timestamp: args.timestamp,
    codeState,
    includeDb: args.includeDb,
  }));

  // ── DB snapshot (opt-in).
  let dbResult = { included: false, reason: 'not_requested' };
  if (args.includeDb) {
    dbResult = await maybeCollectDbSnapshot(true, path.join(stagingDir, 'db-snapshot'));
    console.log(`[diagnostic-inspect] db snapshot: ${dbResult.included ? 'included' : 'skipped (' + dbResult.reason + ')'}`);
  }

  // ── Final safety scan.
  const scanReport = { passedAt: null, files: [], hits: [] };
  function scanFile(file) {
    const rel = path.relative(stagingDir, file).replace(/\\/g, '/');
    const abs = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
    if (SAFETY_SCAN_BYPASS.has(abs)) return;
    const text = fs.readFileSync(file, 'utf8');
    const hits = scanText(text);
    scanReport.files.push({ path: rel, hits });
    if (hits.length > 0) scanReport.hits.push({ path: rel, hits });
  }
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) scanFile(full);
    }
  }
  walk(stagingDir);
  writeText(path.join(stagingDir, 'safety-scan', 'scan-summary.json'), JSON.stringify(scanReport, null, 2));

  if (scanReport.hits.length > 0) {
    const failedNote = [
      'FAILED_SAFETY_SCAN',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      'The following files matched one or more safety patterns:',
      '',
      ...scanReport.hits.map((h) => `  ${h.path}: ${h.hits.join(', ')}`),
      '',
      'NO ZIP was produced. The staging folder is kept for inspection.',
      'Each pattern name is the PATTERN NAME only — no secret value was logged.',
    ].join('\n');
    writeText(path.join(stagingDir, 'FAILED_SAFETY_SCAN.txt'), failedNote);
    console.error(`[diagnostic-inspect] SAFETY SCAN FAILED — ${scanReport.hits.length} file(s) flagged. No ZIP. Inspect ${path.relative(REPO_ROOT, stagingDir)}/FAILED_SAFETY_SCAN.txt`);
    process.exitCode = 2;
    return;
  }
  scanReport.passedAt = new Date().toISOString();
  writeText(path.join(stagingDir, 'safety-scan', 'scan-summary.json'), JSON.stringify(scanReport, null, 2));
  writeText(path.join(stagingDir, 'safety-scan', 'scan-passed.txt'), `Safety scan passed at ${scanReport.passedAt}\nFiles scanned: ${scanReport.files.length}\n`);

  // ── Manifest (built AFTER everything else so it includes itself's neighbors).
  const manifest = buildManifest(stagingDir);
  manifest.meta = {
    timestamp: args.timestamp,
    skillHash,
    branch: codeState.branch,
    lastCommit: (codeState.lastCommit || '').split('\n')[0] || '',
    includeDb: args.includeDb,
    dbResult,
    args: { dry: args.dry, includeAllReports: args.includeAllReports, includeAllJsonl: args.includeAllJsonl },
  };
  writeText(path.join(stagingDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));

  // ── ZIP (skip in dry mode).
  if (args.dry) {
    console.log('[diagnostic-inspect] dry mode — staging only, no ZIP');
    console.log(`[diagnostic-inspect] staged: ${path.relative(REPO_ROOT, stagingDir)}`);
    return;
  }
  const zip = tryZip(stagingDir, zipPath);
  manifest.meta.zipMethod = zip.method;
  writeText(path.join(stagingDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));
  if (zip.method === 'staging_only') {
    console.log(`[diagnostic-inspect] zip backend unavailable; staging folder kept at ${path.relative(REPO_ROOT, stagingDir)}`);
  } else {
    console.log(`[diagnostic-inspect] zip: ${path.relative(REPO_ROOT, zipPath)} (via ${zip.method})`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[diagnostic-inspect][fatal]', String(err && err.message || err).slice(0, 400));
    process.exitCode = 99;
  });
}

module.exports = {
  parseArgs,
  scanText,
  sanitiseLine,
  buildCorpusEventIndex,
  buildCorpusMetrics,
  buildSemanticValues,
  buildDecisionLedger,
  buildGameChangeRecommendations,
  buildUxPlayabilityRecommendations,
  buildAnalysisScript,
  buildReadme,
  buildDiagnosticSummary,
  buildManifest,
  collectSkillHashes,
  collectPackageScripts,
  SAFETY_PATTERNS,
};
