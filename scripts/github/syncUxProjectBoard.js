#!/usr/bin/env node
/**
 * syncUxProjectBoard.js
 *
 * Sync the CDiscourse UX/UI Roadmap GitHub Project + roadmap issues
 * from the canonical card catalogue (`scripts/github/uxBoardCards.json`).
 *
 *   --dry-run (default)  Print the plan; never invoke `gh` to mutate.
 *   --apply              Run `gh` for real. Requires `gh` installed and
 *                        authenticated with the `project` scope.
 *   --owner <login>      Override owner (default from catalogue).
 *   --project-title <s>  Override project title (default from catalogue).
 *
 * Hard rules:
 *   - Never prints tokens or `gh auth status` raw output.
 *   - Never reads `.env*`.
 *   - Refuses to call `gh` unless `--apply` is explicitly passed.
 *   - All planned mutations are deduped by issue prefix (`QOL-NNN`).
 *
 * Exit codes:
 *   0  dry-run printed, or apply ran cleanly
 *   2  validation failure (duplicate prefix, missing field, etc.)
 *   3  `--apply` requested but `gh` is not installed or not authed
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = process.cwd();
const CARDS_PATH = path.join(__dirname, 'uxBoardCards.json');

function parseArgs(argv) {
  const args = { dryRun: true, owner: null, projectTitle: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--apply') args.dryRun = false;
    else if (a === '--owner' && argv[i + 1]) args.owner = argv[++i];
    else if (a === '--project-title' && argv[i + 1]) args.projectTitle = argv[++i];
  }
  return args;
}

function loadCards() {
  const raw = fs.readFileSync(CARDS_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.cards)) throw new Error('uxBoardCards.json missing cards array');
  return data;
}

/** Reject duplicate prefixes / missing labels / missing bodies. */
function validateCatalogue(catalogue) {
  const issues = [];
  const seen = new Set();
  // Catalogue carries only NEW labels we want to create; cards may also reference
  // labels that already exist on the GitHub repo (priority:p0, epic:project-mgmt, etc.).
  // Project field options also need to match the live project schema.
  const opts = catalogue.existingProjectFieldOptions || {};
  for (const card of catalogue.cards) {
    if (!card.prefix || !/^QOL-\d{3}$/.test(card.prefix)) issues.push(`bad prefix: ${card.prefix}`);
    if (seen.has(card.prefix)) issues.push(`duplicate prefix: ${card.prefix}`);
    seen.add(card.prefix);
    if (!card.title || !card.title.startsWith(card.prefix)) issues.push(`${card.prefix}: title must start with prefix`);
    if (!Array.isArray(card.body) || card.body.length === 0) issues.push(`${card.prefix}: body missing`);
    if (!Array.isArray(card.labels) || card.labels.length === 0) issues.push(`${card.prefix}: labels missing`);
    if (opts.priority && card.priority && !opts.priority.includes(card.priority)) issues.push(`${card.prefix}: priority "${card.priority}" not in project schema`);
    if (opts.effort && card.effort && !opts.effort.includes(card.effort)) issues.push(`${card.prefix}: effort "${card.effort}" not in project schema`);
    if (opts.release && card.release && !opts.release.includes(card.release)) issues.push(`${card.prefix}: release "${card.release}" not in project schema`);
    if (opts.epic && card.epic && !opts.epic.includes(card.epic)) issues.push(`${card.prefix}: epic "${card.epic}" not in project schema`);
    if (opts.phase && card.phase && !opts.phase.includes(card.phase)) issues.push(`${card.prefix}: phase "${card.phase}" not in project schema`);
  }
  // Each card body must NOT contain any obvious secret-shape strings.
  const secretShapes = [
    /sk-ant-[A-Za-z0-9_-]{12,}/,
    /xai-[A-Za-z0-9_-]{20,}/,
    /sb_secret_[A-Za-z0-9_-]{8,}/,
    /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/,
    /Bearer\s+[A-Za-z0-9._-]{16,}/,
  ];
  for (const card of catalogue.cards) {
    const bodyText = (card.body || []).join('\n');
    for (const re of secretShapes) {
      if (re.test(bodyText)) issues.push(`${card.prefix}: body contains secret-shape string`);
    }
  }
  return issues;
}

/** Synthesise the issue body GitHub will see, with a footer marker. */
function renderIssueBody(card, catalogue) {
  const lines = [...card.body];
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`_Roadmap card managed by \`scripts/github/syncUxProjectBoard.js\`. Prefix \`${card.prefix}\`. Release \`${card.release}\`. Epic \`${card.epic}\`. Effort \`${card.effort}\`. Priority \`${card.priority}\`._`);
  return lines.join('\n');
}

function hasGhCli() {
  try {
    const r = spawnSync(process.platform === 'win32' ? 'gh.cmd' : 'gh', ['--version'], { encoding: 'utf8' });
    return r.status === 0;
  } catch {
    return false;
  }
}

function ghAuthOk() {
  try {
    const r = spawnSync(process.platform === 'win32' ? 'gh.cmd' : 'gh', ['auth', 'status'], { encoding: 'utf8', stdio: 'pipe' });
    // gh writes auth status to stderr; status 0 means OK
    return r.status === 0;
  } catch {
    return false;
  }
}

function printDryRunPlan(catalogue, owner, projectTitle) {
  console.log(`# Dry-run plan for ${projectTitle} (owner: ${owner}, project #${catalogue.projectNumber})`);
  console.log('');
  console.log('## New labels to ensure (created if missing on the repo)');
  for (const l of catalogue.labels || []) console.log(`- ${l.name}    (#${l.color})    ${l.description}`);
  console.log('');
  console.log('## Issues to create (deduped by prefix against existing GH issues)');
  for (const card of catalogue.cards) {
    console.log(`- ${card.prefix}    ${card.title}`);
    console.log(`    labels: ${card.labels.join(', ')}`);
    console.log(`    epic=${card.epic} · release=${card.release} · priority=${card.priority} · effort=${card.effort} · phase=${card.phase}`);
  }
  console.log('');
  if (catalogue.supersededByExisting) {
    console.log('## Skipped (superseded by existing issues)');
    for (const [k, v] of Object.entries(catalogue.supersededByExisting)) console.log(`- ${k} -> ${v}`);
    console.log('');
  }
  console.log(`## Total: ${catalogue.cards.length} new cards · ${(catalogue.labels || []).length} new labels`);
  console.log('');
  console.log('Re-run with `--apply` to invoke `gh` for real (delegates to scripts/github/applyUxProjectBoard.sh).');
}

function applyWithGh(catalogue, owner, projectTitle) {
  if (!hasGhCli()) {
    console.error('[sync-ux-board] gh CLI is not installed. Install from https://cli.github.com/ then run `gh auth login` and `gh auth refresh -s project`.');
    process.exitCode = 3;
    return;
  }
  if (!ghAuthOk()) {
    console.error('[sync-ux-board] gh is installed but not authenticated. Run `gh auth login`, then `gh auth refresh -s project`.');
    process.exitCode = 3;
    return;
  }
  console.error('[sync-ux-board] --apply path is not auto-mutating in this commit.');
  console.error('[sync-ux-board] Run the operator script instead: bash scripts/github/applyUxProjectBoard.sh');
  console.error('[sync-ux-board] (it embeds the exact `gh` commands the dry-run prints).');
  process.exitCode = 3;
}

function main() {
  const args = parseArgs(process.argv);
  const catalogue = loadCards();
  const owner = args.owner || catalogue.projectOwner || catalogue.owner;
  const projectTitle = args.projectTitle || catalogue.projectTitle;

  const issues = validateCatalogue(catalogue);
  if (issues.length > 0) {
    console.error('[sync-ux-board] catalogue validation FAILED:');
    for (const i of issues) console.error(`  - ${i}`);
    process.exitCode = 2;
    return;
  }
  const labelCount = Array.isArray(catalogue.labels) ? catalogue.labels.length : 0;
  console.log(`[sync-ux-board] catalogue OK · ${catalogue.cards.length} cards · ${labelCount} new labels to ensure · project #${catalogue.projectNumber} on ${catalogue.projectOwner}`);
  console.log('');

  if (args.dryRun) {
    printDryRunPlan(catalogue, owner, projectTitle);
    return;
  }
  applyWithGh(catalogue, owner, projectTitle);
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  loadCards,
  validateCatalogue,
  renderIssueBody,
  hasGhCli,
  ghAuthOk,
};
