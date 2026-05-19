#!/usr/bin/env node
/**
 * agentIssueRunner.js
 *
 * Issue-agent operating system for CDiscourse. Manages the GitHub side of
 * the workflow documented in `docs/agent-workflow.md`:
 *
 *   queue    -- print the prioritized open-issue queue
 *   claim    -- comment + Project Status In Progress + label agent:active
 *   signoff  -- comment + Project Status update + optional close + label
 *   ledger   -- print Markdown rows for docs/product-status-ledger.md
 *
 * Dry-run is the default for every command. Mutation requires --apply.
 *
 * Hard rules:
 *   - Never prints tokens, gh auth status raw output, or any Authorization
 *     header value.
 *   - Never reads .env*.
 *   - Refuses to mutate GitHub unless --apply is explicitly passed.
 *   - Refuses to close an issue from sign-off status "Needs Review" /
 *     "Blocked" / "In Progress" -- only Done + commit body containing
 *     `Closes #<n>` is allowed to close.
 *   - All pure helpers are exported for tests.
 */

'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = 'kyleruff1/cDiscourse';
const PROJECT_NUMBER = 1;
const PROJECT_OWNER = 'kyleruff1';
const PROJECT_ID = 'PVT_kwHOAvpEDc4BYA8w';

const ROADMAP_PREFIXES = ['QOL', 'TL', 'VG', 'BR', 'SC', 'ST', 'EV', 'SW', 'IX', 'PR', 'HOST', 'GAL', 'RULE', 'AN', 'PM', 'LIFE', 'META', 'GAME', 'BRAND', 'COPY', 'HIST', 'NAV', 'LEG', 'A11Y'];

// Static field/option ID map captured live on 2026-05-18 from
// `gh project field-list 1 --owner kyleruff1 --format json`. The applier
// script reads these live; this runner uses the static map so the dry-run
// path stays offline. Re-snapshot if the project schema changes.
const FIELD_IDS = {
  Status:   'PVTSSF_lAHOAvpEDc4BYA8wzhTJs4E',
  Priority: 'PVTSSF_lAHOAvpEDc4BYA8wzhTJs4w',
  Effort:   'PVTSSF_lAHOAvpEDc4BYA8wzhTJs40',
  Epic:     'PVTSSF_lAHOAvpEDc4BYA8wzhTJs48',
  Release:  'PVTSSF_lAHOAvpEDc4BYA8wzhTJs5A',
  Phase:    'PVTSSF_lAHOAvpEDc4BYA8wzhTJwz4',
};
const OPTION_IDS = {
  Status: { Todo: 'f75ad846', 'In Progress': '47fc9ee4', Done: '98236657' },
  Phase:  { Backlog: '3cfd612c', Design: 'c509004d', Build: 'b1c8aa85', Review: '872509bd', Done: 'db9343eb', Blocked: '1ea63358' },
};

// Map sign-off product status -> Project Status + Project Phase.
// "In Progress" sign-off keeps the agent in Build phase. This is the
// only place that knows the mapping.
const STATUS_TO_PROJECT = Object.freeze({
  Done:           { status: 'Done',        phase: 'Done' },
  'Needs Review': { status: 'In Progress', phase: 'Review' },
  Blocked:        { status: 'In Progress', phase: 'Blocked' },
  'In Progress':  { status: 'In Progress', phase: 'Build' },
});

const VALID_SIGNOFF_STATUSES = Object.keys(STATUS_TO_PROJECT);
const VALID_PRODUCT_STATUSES = Object.freeze(['Not Started', ...VALID_SIGNOFF_STATUSES]);

// Files that should NEVER be staged. The runner does not enforce this
// itself (commits happen outside the runner); the list lives here so
// `qa-verifier-agent` and the test suite share one source of truth.
const SAFE_STAGE_DENYLIST = Object.freeze([
  /^\.env(\..+)?$/,
  /^logs(\/|$)/,
  /^artifacts\/diagnostics(\/|$)/,
  /^node_modules(\/|$)/,
  /^\.expo(\/|$)/,
  /^\.claude\/worktrees(\/|$)/,
  /^data\/engagement-intelligence\/raw(\/|$)/,
  /\.jsonl$/,
]);

// ─── Pure helpers (exported for tests) ───────────────────────────────

function parseArgs(argv) {
  const args = { command: null, flags: {}, apply: false };
  if (argv.length < 3) return args;
  args.command = argv[2];
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') { args.apply = true; continue; }
    if (a === '--dry' || a === '--dry-run') { args.apply = false; continue; }
    if (a.startsWith('--') && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) {
      args.flags[a.slice(2)] = argv[++i];
    } else if (a.startsWith('--')) {
      args.flags[a.slice(2)] = true;
    }
  }
  return args;
}

/** Extract a roadmap prefix (e.g., "SW-001", "QOL-015") from an issue title. */
function parseIssuePrefix(title) {
  if (!title || typeof title !== 'string') return null;
  const m = title.match(/^([A-Z0-9]+)-(\d+[A-Z]?)\b/);
  if (!m) return null;
  if (!ROADMAP_PREFIXES.includes(m[1])) return null;
  return { prefix: `${m[1]}-${m[2]}`, family: m[1], number: parseInt(m[2], 10) };
}

/** Read a single label value (e.g., 'priority:p0' -> 'p0') given a label list. */
function readLabel(labels, key) {
  if (!Array.isArray(labels)) return null;
  for (const l of labels) {
    const name = typeof l === 'string' ? l : l && l.name;
    if (!name) continue;
    if (name.startsWith(`${key}:`)) return name.slice(key.length + 1);
  }
  return null;
}

const PRIORITY_ORDER = { p0: 0, p1: 1, p2: 2 };
const EFFORT_ORDER = { s: 0, m: 1, l: 2, xl: 3 };
const RELEASE_ORDER = { '6.5': 0, '6.6': 1, '6.7': 2, '6.8': 3 };

/** Sort comparator: P0 first, then release ascending, then effort, then number. */
function compareIssuesForQueue(a, b) {
  const pa = PRIORITY_ORDER[readLabel(a.labels, 'priority')] ?? 9;
  const pb = PRIORITY_ORDER[readLabel(b.labels, 'priority')] ?? 9;
  if (pa !== pb) return pa - pb;
  const ra = RELEASE_ORDER[readLabel(a.labels, 'release')] ?? 9;
  const rb = RELEASE_ORDER[readLabel(b.labels, 'release')] ?? 9;
  if (ra !== rb) return ra - rb;
  const ea = EFFORT_ORDER[readLabel(a.labels, 'effort')] ?? 9;
  const eb = EFFORT_ORDER[readLabel(b.labels, 'effort')] ?? 9;
  if (ea !== eb) return ea - eb;
  return (a.number || 0) - (b.number || 0);
}

/** Produce the commit-message footer that issue-agent commits must use. */
function renderCommitFooter({ issueNumber, productStatus, projectStatus, projectPhase, verification, agent, scope, docs, notes, closes }) {
  const lines = [];
  if (closes) lines.push(`Closes #${issueNumber}`);
  else lines.push(`Refs: #${issueNumber}`);
  lines.push(`Product-Status: ${productStatus}`);
  lines.push(`Project-Status: ${projectStatus}`);
  lines.push(`Project-Phase: ${projectPhase}`);
  lines.push(`Verification: typecheck=${verification.typecheck}; lint=${verification.lint}; tests=${verification.tests}`);
  lines.push(`Agent: ${agent}`);
  lines.push(`Scope: ${scope}`);
  lines.push(`Docs: ${docs}`);
  if (notes) lines.push(`Notes: ${notes}`);
  return lines.join('\n');
}

/** Body of the comment posted by `claim`. */
function renderClaimComment({ agent, branch, scope, verificationTargets }) {
  return [
    `Agent started: \`${agent}\`.`,
    `Branch: \`${branch}\`.`,
    `Scope: ${scope}.`,
    `Verification target: \`${verificationTargets.join(' && ')}\`.`,
    '',
    '_Posted by `scripts/github/agentIssueRunner.js claim`._',
  ].join('\n');
}

/** Body of the comment posted by `signoff`. */
function renderSignoffComment({ agent, commit, subject, verification, productStatus, filesChanged, topFiles, remainingGaps, issueClosed }) {
  return [
    `Agent finished: \`${agent}\`. Commit: \`${commit}\` (${subject || 'see commit'}).`,
    '',
    `Verification: \`typecheck=${verification.typecheck}; lint=${verification.lint}; tests=${verification.tests}\``,
    `Product status: \`${productStatus}\``,
    `Files changed: ${filesChanged} (${(topFiles || []).slice(0, 5).join(', ') || '—'})`,
    `Remaining gaps: ${remainingGaps && remainingGaps.length ? remainingGaps.map(g => `\n- ${g}`).join('') : 'none'}`,
    `Issue status: ${issueClosed ? 'closed' : 'still open'}`,
    '',
    '_Posted by `scripts/github/agentIssueRunner.js signoff`._',
  ].join('\n');
}

/** Validate a sign-off status transition request. Returns issues[]. */
function validateSignoffTransition({ status, commitBody }) {
  const issues = [];
  if (!VALID_SIGNOFF_STATUSES.includes(status)) {
    issues.push(`unknown status "${status}" (valid: ${VALID_SIGNOFF_STATUSES.join(', ')})`);
  }
  if (status === 'Done' && commitBody && !/closes\s+#\d+/i.test(commitBody)) {
    issues.push('status=Done requires the commit body to contain "Closes #<n>"');
  }
  return issues;
}

/** Return true if the given staged path would violate the safe-stage denylist. */
function isUnsafeStagedPath(p) {
  if (!p) return false;
  const norm = p.replace(/\\/g, '/');
  return SAFE_STAGE_DENYLIST.some((re) => re.test(norm));
}

/** Build a Markdown ledger row from an issue + status payload. */
function renderLedgerRow({ date, issue, status, commit, agent, verification, notes }) {
  const issueLabel = `#${issue.number} ${(parseIssuePrefix(issue.title) || {}).prefix || '???'}`;
  const title = issue.title.replace(/^[A-Z]+-\d+\s*[-—:]\s*/, '');
  const tc = verification ? verification.typecheck : '—';
  const lint = verification ? verification.lint : '—';
  const tests = verification ? verification.tests : '—';
  const verCell = verification ? `tc=${tc}; lint=${lint}; tests=${tests}` : '—';
  return `| ${date} | ${issueLabel} | ${title} | ${status} | ${commit || '—'} | ${agent || '—'} | ${verCell} | ${notes || ''} |`;
}

/** Build a queue table row (Markdown). */
function renderQueueRow(issue) {
  const parsed = parseIssuePrefix(issue.title) || { prefix: '???' };
  return `${String(issue.number).padStart(3, ' ')}  ${parsed.prefix.padEnd(10)}  ${(readLabel(issue.labels, 'priority') || '??').padEnd(3)}  ${(readLabel(issue.labels, 'release') || '??').padEnd(4)}  ${(readLabel(issue.labels, 'effort') || '??').padEnd(3)}  ${issue.title}`;
}

/** Build the exact gh commands that would mutate GitHub for a claim. */
function planClaimCommands({ issueNumber, comment }) {
  return [
    { kind: 'comment', cmd: ['gh', 'issue', 'comment', String(issueNumber), '--repo', REPO, '--body', comment] },
    { kind: 'label', cmd: ['gh', 'issue', 'edit', String(issueNumber), '--repo', REPO, '--add-label', 'agent:active'] },
  ];
}

/** Build the exact gh commands that would mutate GitHub for a sign-off. */
function planSignoffCommands({ issueNumber, comment, status, projectItemId, closeIssue }) {
  const cmds = [
    { kind: 'comment', cmd: ['gh', 'issue', 'comment', String(issueNumber), '--repo', REPO, '--body', comment] },
  ];
  const mapped = STATUS_TO_PROJECT[status];
  if (mapped && projectItemId) {
    cmds.push({
      kind: 'project-status',
      cmd: ['gh', 'project', 'item-edit', '--id', projectItemId, '--project-id', PROJECT_ID, '--field-id', FIELD_IDS.Status, '--single-select-option-id', OPTION_IDS.Status[mapped.status]],
    });
    cmds.push({
      kind: 'project-phase',
      cmd: ['gh', 'project', 'item-edit', '--id', projectItemId, '--project-id', PROJECT_ID, '--field-id', FIELD_IDS.Phase, '--single-select-option-id', OPTION_IDS.Phase[mapped.phase]],
    });
  }
  cmds.push({ kind: 'unlabel', cmd: ['gh', 'issue', 'edit', String(issueNumber), '--repo', REPO, '--remove-label', 'agent:active'] });
  if (status === 'Done') {
    cmds.push({ kind: 'label', cmd: ['gh', 'issue', 'edit', String(issueNumber), '--repo', REPO, '--add-label', 'agent:done'] });
  } else if (status === 'Blocked') {
    cmds.push({ kind: 'label', cmd: ['gh', 'issue', 'edit', String(issueNumber), '--repo', REPO, '--add-label', 'agent:blocked'] });
  }
  if (closeIssue) {
    cmds.push({ kind: 'close', cmd: ['gh', 'issue', 'close', String(issueNumber), '--repo', REPO] });
  }
  return cmds;
}

// ─── gh shell-out (impure) ───────────────────────────────────────────

/**
 * Resolve which GitHub CLI binary to call. Pure helper: takes its
 * environment, platform, and spawner via options so tests can inject
 * a fake spawner without touching real PATH.
 *
 * Order:
 *   1. `env.GH_BIN` if set (operator override).
 *   2. On win32: `gh.exe`, then `gh.cmd`, then `gh`.
 *      (WinGet installs gh.exe; some shells expose only gh.cmd; Git Bash
 *       resolves bare `gh` to whatever PATH finds first.)
 *   3. On non-Windows: `gh`.
 *
 * A candidate is "working" when `<bin> --version` exits 0. The first
 * working candidate wins. Throws a directive error if none work.
 */
function resolveGhBin({
  env = process.env,
  platform = process.platform,
  spawn = spawnSync,
} = {}) {
  const candidates = [];
  if (env.GH_BIN) candidates.push(env.GH_BIN);
  if (platform === 'win32') {
    candidates.push('gh.exe', 'gh.cmd', 'gh');
  } else {
    candidates.push('gh');
  }
  for (const bin of candidates) {
    let r;
    try {
      r = spawn(bin, ['--version'], { stdio: 'ignore' });
    } catch {
      continue;
    }
    if (r && r.status === 0) return bin;
  }
  const hint = platform === 'win32'
    ? "Try: $env:GH_BIN = '<absolute path to gh.exe>' (e.g., the WinGet install path)."
    : 'Try: export GH_BIN=<absolute path to gh>.';
  throw new Error(
    'GitHub CLI not found. Install GitHub CLI and ensure `gh` is on PATH, '
    + 'or set GH_BIN to its absolute path. '
    + hint + ' '
    + `Tried: ${candidates.join(', ')}.`,
  );
}

let _ghBinCache = null;
function ghBin() {
  if (_ghBinCache) return _ghBinCache;
  _ghBinCache = resolveGhBin();
  return _ghBinCache;
}

function runGh(args, { capture = true } = {}) {
  const r = spawnSync(ghBin(), args, { encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function fetchOpenRoadmapIssues() {
  const r = runGh(['issue', 'list', '--repo', REPO, '--state', 'open', '--limit', '200', '--json', 'number,title,labels,url,updatedAt']);
  if (r.status !== 0) {
    throw new Error('failed to list open issues (gh exit code ' + r.status + ')');
  }
  const arr = JSON.parse(r.stdout || '[]');
  return arr.filter((i) => parseIssuePrefix(i.title) !== null);
}

function resolveProjectItemIdForIssue(issueUrl) {
  const r = runGh(['project', 'item-list', String(PROJECT_NUMBER), '--owner', PROJECT_OWNER, '--limit', '200', '--format', 'json']);
  if (r.status !== 0) return null;
  let data;
  try { data = JSON.parse(r.stdout); } catch { return null; }
  for (const item of data.items || []) {
    if (item && item.content && item.content.url === issueUrl) return item.id;
  }
  return null;
}

// ─── Command implementations ─────────────────────────────────────────

function cmdQueue(args) {
  const issues = fetchOpenRoadmapIssues();
  const sorted = issues.slice().sort(compareIssuesForQueue);
  console.log('# Open roadmap queue (priority ↓, release ↓, effort ↓, number ↑)');
  console.log('');
  console.log('   #  prefix      pri  rel   eff  title');
  for (const i of sorted) console.log(renderQueueRow(i));
  console.log('');
  console.log(`# ${sorted.length} open roadmap issues. Top of queue is the recommended next pick.`);
}

function cmdClaim(args) {
  const issueNumber = parseInt(args.flags.issue, 10);
  const agent = args.flags.agent;
  if (!issueNumber || !agent) {
    console.error('[agent-runner] claim requires --issue <n> and --agent <name>');
    process.exitCode = 2;
    return;
  }
  const branch = args.flags.branch || `agent/${issueNumber}`;
  const scope = args.flags.scope || `work issue #${issueNumber}`;
  const verificationTargets = (args.flags.verify || 'npm run typecheck && npm run lint && npm run test').split(' && ');
  const comment = renderClaimComment({ agent, branch, scope, verificationTargets });
  const plan = planClaimCommands({ issueNumber, comment });

  if (!args.apply) {
    console.log(`# DRY-RUN claim plan for issue #${issueNumber} (agent=${agent})`);
    console.log('');
    for (const c of plan) console.log('+ ' + c.cmd.join(' '));
    console.log('');
    console.log('Re-run with --apply to mutate GitHub.');
    return;
  }
  for (const c of plan) {
    const r = runGh(c.cmd.slice(1));
    if (r.status === 0) console.log(`[agent-runner] ${c.kind}: ok`);
    else console.error(`[agent-runner] ${c.kind}: gh exit ${r.status}  (continuing)`);
  }
}

function cmdSignoff(args) {
  const issueNumber = parseInt(args.flags.issue, 10);
  const status = args.flags.status;
  const agent = args.flags.agent;
  const commit = args.flags.commit;
  if (!issueNumber || !status || !agent || !commit) {
    console.error('[agent-runner] signoff requires --issue <n> --status <…> --agent <name> --commit <hash>');
    process.exitCode = 2;
    return;
  }
  const issues = validateSignoffTransition({ status, commitBody: args.flags.commitBody });
  if (issues.length > 0) {
    console.error('[agent-runner] signoff validation FAILED:');
    for (const i of issues) console.error(`  - ${i}`);
    process.exitCode = 2;
    return;
  }
  const verification = {
    typecheck: args.flags.typecheck || 'pass',
    lint: args.flags.lint || 'pass',
    tests: args.flags.tests || 'pass',
  };
  const closeIssue = status === 'Done' && /closes\s+#\d+/i.test(args.flags.commitBody || '');
  const comment = renderSignoffComment({
    agent,
    commit,
    subject: args.flags.subject,
    verification,
    productStatus: status,
    filesChanged: parseInt(args.flags.filesChanged || '0', 10) || 0,
    topFiles: (args.flags.topFiles || '').split(',').filter(Boolean),
    remainingGaps: (args.flags.gaps || '').split('|').filter(Boolean),
    issueClosed: closeIssue,
  });

  // Resolve project item id only if we are actually applying.
  let projectItemId = null;
  if (args.apply && args.flags.issueUrl) {
    projectItemId = resolveProjectItemIdForIssue(args.flags.issueUrl);
  } else if (!args.apply) {
    projectItemId = '<resolved-at-apply-time>';
  }
  const plan = planSignoffCommands({ issueNumber, comment, status, projectItemId, closeIssue });

  if (!args.apply) {
    console.log(`# DRY-RUN signoff plan for issue #${issueNumber} (status=${status})`);
    console.log('');
    for (const c of plan) console.log('+ ' + c.cmd.join(' '));
    console.log('');
    console.log('Re-run with --apply to mutate GitHub.');
    console.log('Note: project-status/phase mutation needs --issue-url <url> at apply time to resolve project item id.');
    return;
  }
  for (const c of plan) {
    if ((c.kind === 'project-status' || c.kind === 'project-phase') && !projectItemId) {
      console.warn(`[agent-runner] ${c.kind}: skipped (no project item id resolved; pass --issue-url next time)`);
      continue;
    }
    const r = runGh(c.cmd.slice(1));
    if (r.status === 0) console.log(`[agent-runner] ${c.kind}: ok`);
    else console.error(`[agent-runner] ${c.kind}: gh exit ${r.status}  (continuing)`);
  }
}

function cmdLedger(args) {
  const issues = fetchOpenRoadmapIssues();
  const sorted = issues.slice().sort(compareIssuesForQueue);
  console.log('| Date | Issue | Title | Status | Commit | Agent | Verification | Notes |');
  console.log('|---|---|---|---|---|---|---|---|');
  const today = new Date().toISOString().slice(0, 10);
  for (const i of sorted) {
    console.log(renderLedgerRow({
      date: today,
      issue: i,
      status: 'Not Started',
      commit: null,
      agent: null,
      verification: null,
      notes: '',
    }));
  }
}

// ─── Entry point ─────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv);
  if (!args.command) {
    console.error('Usage: agentIssueRunner.js <queue|claim|signoff|ledger> [--apply] [flags]');
    process.exitCode = 2;
    return;
  }
  switch (args.command) {
    case 'queue':   return cmdQueue(args);
    case 'claim':   return cmdClaim(args);
    case 'signoff': return cmdSignoff(args);
    case 'ledger':  return cmdLedger(args);
    default:
      console.error(`unknown command: ${args.command}`);
      process.exitCode = 2;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  // Pure helpers
  parseArgs,
  parseIssuePrefix,
  readLabel,
  compareIssuesForQueue,
  renderCommitFooter,
  renderClaimComment,
  renderSignoffComment,
  validateSignoffTransition,
  isUnsafeStagedPath,
  renderLedgerRow,
  renderQueueRow,
  planClaimCommands,
  planSignoffCommands,
  resolveGhBin,
  // Constants
  STATUS_TO_PROJECT,
  VALID_SIGNOFF_STATUSES,
  VALID_PRODUCT_STATUSES,
  SAFE_STAGE_DENYLIST,
  ROADMAP_PREFIXES,
  REPO,
  PROJECT_NUMBER,
  PROJECT_OWNER,
  PROJECT_ID,
  FIELD_IDS,
  OPTION_IDS,
};
