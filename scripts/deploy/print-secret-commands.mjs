#!/usr/bin/env node
// HOST-005 — Print operator-runnable `gcloud secrets` command shapes from the
// manifest at infra/secrets/cdiscourse-dev-manifest.json (or any compatible
// prod manifest passed via --manifest=).
//
// Doctrine:
//   - The agent NEVER runs any `gcloud` command. This helper only prints
//     command shapes to stdout. The operator pastes them into their own
//     authenticated shell.
//   - The helper NEVER accepts a secret value as input. No --value flag.
//     No stdin reading. No `.env*` file read.
//   - The helper REFUSES if the manifest contains a forbidden name
//     (service-role / Anthropic / xAI / X bearer / Resend / *-api-key /
//     *-secret-key) or a value-shaped string literal in any field.
//   - The helper prints `gcloud secrets versions add ... --data-file=-`
//     with an instruction comment block telling the operator to type / paste
//     the value on stdin (Ctrl-D / Ctrl-Z+Enter to send EOF). The helper does
//     NOT print `printf %s "<VALUE>" | gcloud ...` with an inline value
//     substitution because that would suggest the operator put the value on
//     the command line (history risk).
//
// Exit codes:
//   0  printed successfully
//   2  manifest parse / schema error (path printed to stderr)
//   3  manifest contains forbidden name (name printed to stderr)
//   4  manifest contains value-shaped literal (only field path printed)
//   5  --manifest flag missing

import { readFileSync, existsSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(__filename, '..', '..', '..');

// EXPO_PUBLIC_ env-var prefix constraint — re-asserted at runtime even though
// the schema also enforces it, so a manual schema bypass cannot get around it.
const REQUIRED_ENV_VAR_PREFIX = 'EXPO_PUBLIC_';

// Forbidden tokens. Match by case-insensitive substring on every string value
// in the manifest. Any hit is exit 3.
const FORBIDDEN_NAME_TOKENS = [
  'service-role',
  'service_role',
  'anthropic',
  'xai',
  'x-bearer',
  'x_bearer',
  'resend',
  'bearer',
  '-api-key',
  '_api_key',
  '-secret-key',
  '_secret_key',
  'supabase_service_role_key',
  'sb-secret',
  'sb_secret',
];

// Value-shape literals. If any manifest string field matches one of these
// patterns, the helper refuses with exit 4.
const VALUE_SHAPE_PATTERNS = [
  // sk-ant-* Anthropic key prefix
  /\bsk-ant-/i,
  // xai-* xAI key prefix
  /\bxai-[A-Za-z0-9_]/i,
  // sb_secret_* Supabase service-role / secret-key prefix
  /\bsb_secret_/i,
  // sb_publishable_* Supabase publishable-key prefix
  /\bsb_publishable_/i,
  // JWT-shaped token: eyJ followed by 10+ url-safe chars
  /\beyJ[A-Za-z0-9_.-]{10,}/,
  // OAuth bearer prefix
  /\bBearer\s+[A-Za-z0-9_.-]/,
  // Supabase project URL ending in .supabase.co
  /https?:\/\/[A-Za-z0-9-]+\.supabase\.co/i,
];

function parseArgs(argv) {
  const out = {
    manifest: '',
    includeVersionsAdd: true,
    includeIamBinding: true,
  };
  for (const arg of argv) {
    if (arg.startsWith('--manifest=')) out.manifest = arg.slice('--manifest='.length);
    else if (arg === '--no-include-versions-add') out.includeVersionsAdd = false;
    else if (arg === '--include-versions-add') out.includeVersionsAdd = true;
    else if (arg === '--no-include-iam-binding') out.includeIamBinding = false;
    else if (arg === '--include-iam-binding') out.includeIamBinding = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return out;
}

function printHelp() {
  process.stdout.write(
    [
      'print-secret-commands.mjs — emit operator-runnable gcloud secret commands.',
      '',
      'Flags:',
      '  --manifest=<path>           Required. Path to the manifest JSON file.',
      '  --include-versions-add      Include `gcloud secrets versions add` shapes (default: on).',
      '  --no-include-versions-add   Suppress versions-add section.',
      '  --include-iam-binding       Include IAM binding shapes (default: on).',
      '  --no-include-iam-binding    Suppress IAM binding section.',
      '  --help / -h                 Show this help.',
      '',
      'Doctrine: helper never accepts a value, never reads .env, never runs gcloud.',
      '',
    ].join('\n'),
  );
}

// Recursive scan: visit every string in the manifest and call cb(path, value).
function visitStrings(node, path, cb) {
  if (typeof node === 'string') {
    cb(path, node);
    return;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      visitStrings(node[i], `${path}[${i}]`, cb);
    }
    return;
  }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      visitStrings(node[k], path ? `${path}.${k}` : k, cb);
    }
  }
}

function matchesForbiddenToken(value) {
  const lower = value.toLowerCase();
  for (const token of FORBIDDEN_NAME_TOKENS) {
    if (lower.includes(token)) return token;
  }
  return null;
}

function matchesValueShape(value) {
  for (const re of VALUE_SHAPE_PATTERNS) {
    if (re.test(value)) return re.source;
  }
  return null;
}

function refuse(exitCode, message) {
  process.stderr.write(`${message}\n`);
  process.exit(exitCode);
}

function resolveManifestPath(manifestArg) {
  if (!manifestArg) return null;
  return isAbsolute(manifestArg) ? manifestArg : resolve(REPO_ROOT, manifestArg);
}

function readManifest(manifestPath) {
  let raw;
  try {
    raw = readFileSync(manifestPath, 'utf8');
  } catch (err) {
    refuse(2, `manifest read failed: ${err.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    refuse(2, `manifest parse failed: ${err.message}`);
  }
  return parsed;
}

// Minimal hand-rolled schema check, sufficient for the v0 manifest shape.
// Full validation is performed by the schema file's draft-07 contract — but
// here we re-assert the structural invariants the helper depends on without
// dragging in a JSON Schema library.
function validateManifestShape(m) {
  if (m === null || typeof m !== 'object' || Array.isArray(m)) {
    refuse(2, 'manifest is not a JSON object');
  }
  const required = [
    'version',
    'environment',
    'project',
    'region',
    'runtimeServiceAccount',
    'replicationPolicy',
    'versionBindingPolicy',
    'labels',
    'secrets',
  ];
  for (const key of required) {
    if (!(key in m)) refuse(2, `manifest missing required field: ${key}`);
  }
  if (m.version !== 1) refuse(2, 'manifest.version must be 1');
  if (m.environment !== 'dev' && m.environment !== 'prod') refuse(2, 'manifest.environment must be dev|prod');
  if (m.project !== 'cdiscourse-host') refuse(2, 'manifest.project must be cdiscourse-host');
  if (m.region !== 'us-central1') refuse(2, 'manifest.region must be us-central1');
  if (m.replicationPolicy !== 'automatic') refuse(2, 'manifest.replicationPolicy must be automatic');
  if (m.versionBindingPolicy !== 'latest') refuse(2, 'manifest.versionBindingPolicy must be latest');
  if (!Array.isArray(m.secrets) || m.secrets.length < 1) {
    refuse(2, 'manifest.secrets must be a non-empty array');
  }
  if (
    typeof m.runtimeServiceAccount !== 'string' ||
    !/^cdiscourse-(dev|prod)-runner@cdiscourse-host\.iam\.gserviceaccount\.com$/.test(m.runtimeServiceAccount)
  ) {
    refuse(2, 'manifest.runtimeServiceAccount has wrong shape');
  }
  const seenNames = new Set();
  const seenEnvVars = new Set();
  for (let i = 0; i < m.secrets.length; i += 1) {
    const s = m.secrets[i];
    if (!s || typeof s !== 'object') refuse(2, `secrets[${i}] is not an object`);
    for (const k of ['name', 'cloudRunEnvVar', 'purpose', 'consumerFile']) {
      if (typeof s[k] !== 'string' || s[k].length === 0) {
        refuse(2, `secrets[${i}].${k} is missing or not a string`);
      }
    }
    if (!/^cdiscourse-(dev|prod)-[a-z0-9-]+$/.test(s.name)) {
      refuse(2, `secrets[${i}].name does not match cdiscourse-(dev|prod)-* pattern: ${s.name}`);
    }
    if (s.name.length < 18 || s.name.length > 63) {
      refuse(2, `secrets[${i}].name length out of range (18..63)`);
    }
    if (!s.cloudRunEnvVar.startsWith(REQUIRED_ENV_VAR_PREFIX)) {
      refuse(2, `secrets[${i}].cloudRunEnvVar must start with ${REQUIRED_ENV_VAR_PREFIX}: ${s.cloudRunEnvVar}`);
    }
    if (!/^EXPO_PUBLIC_[A-Z0-9_]+$/.test(s.cloudRunEnvVar)) {
      refuse(2, `secrets[${i}].cloudRunEnvVar has wrong shape: ${s.cloudRunEnvVar}`);
    }
    if (!s.consumerFile.startsWith('src/')) {
      refuse(2, `secrets[${i}].consumerFile must start with src/: ${s.consumerFile}`);
    }
    if (seenNames.has(s.name)) refuse(2, `duplicate secret name: ${s.name}`);
    if (seenEnvVars.has(s.cloudRunEnvVar)) refuse(2, `duplicate cloudRunEnvVar: ${s.cloudRunEnvVar}`);
    seenNames.add(s.name);
    seenEnvVars.add(s.cloudRunEnvVar);
  }
}

function scanForbiddenNames(m) {
  for (let i = 0; i < m.secrets.length; i += 1) {
    const token = matchesForbiddenToken(m.secrets[i].name);
    if (token) {
      refuse(3, `secrets[${i}].name contains forbidden token "${token}": ${m.secrets[i].name}`);
    }
    const envToken = matchesForbiddenToken(m.secrets[i].cloudRunEnvVar);
    if (envToken) {
      refuse(3, `secrets[${i}].cloudRunEnvVar contains forbidden token "${envToken}"`);
    }
  }
}

function scanValueShapes(m) {
  visitStrings(m, '', (path, value) => {
    const hit = matchesValueShape(value);
    if (hit) {
      refuse(4, `value-shaped literal at ${path} (pattern: ${hit})`);
    }
  });
}

function renderHeader(manifestRelPath, m) {
  const ts = new Date().toISOString();
  return [
    `# HOST-005 - operator-runnable secret commands (generated ${ts})`,
    `# Manifest:   ${manifestRelPath}`,
    `# Project:    ${m.project}`,
    `# Region:     ${m.region}`,
    `# Runtime SA: ${m.runtimeServiceAccount}`,
    '#',
    '# The agent did NOT run any of these commands. The operator runs them in',
    '# their own authenticated shell. Values are NEVER passed on the command',
    '# line - the operator types or pastes the value on stdin (--data-file=-).',
    '#',
    '# After each step that handles a value, the operator clears shell history',
    '# and clipboard:',
    '#   - PowerShell: Clear-History; Set-Clipboard $null',
    '#   - bash/zsh:   history -c; pbcopy < /dev/null   (or xclip - clipboard < /dev/null)',
    '',
  ].join('\n');
}

function renderCreateSection(m) {
  const lines = ['# --- Step A: create each secret (run once per secret; idempotent labels) ---', ''];
  for (const s of m.secrets) {
    lines.push(`gcloud secrets create ${s.name} \\`);
    lines.push(`  --replication-policy=${m.replicationPolicy} \\`);
    lines.push(`  --labels=env=${m.labels.env},card=host-005 \\`);
    lines.push(`  --project=${m.project}`);
    lines.push('');
  }
  return lines.join('\n');
}

function renderVersionsAddSection(m) {
  const lines = [
    '# --- Step B: add the first version of each secret ---',
    '# Operator runs each `versions add` command, then types or pastes the value',
    '# on stdin and sends EOF:',
    '#   bash/zsh:   Ctrl-D after the value',
    '#   PowerShell: Ctrl-Z then Enter after the value',
    '# The value is NEVER passed as an argv literal, NEVER read from a file by',
    '# this helper, and NEVER seen by the agent.',
    '',
  ];
  for (const s of m.secrets) {
    lines.push(`# Step B - operator runs this. Paste the value when prompted; do NOT type it on the command line.`);
    lines.push(`gcloud secrets versions add ${s.name} \\`);
    lines.push(`  --data-file=- \\`);
    lines.push(`  --project=${m.project}`);
    lines.push('# then type / paste the value, Ctrl-D to send EOF (bash) or Ctrl-Z then Enter (PowerShell)');
    lines.push('# Immediately after: Clear-History; Set-Clipboard $null   (PowerShell)');
    lines.push('#                    history -c; pbcopy < /dev/null         (bash/zsh)');
    lines.push('');
  }
  return lines.join('\n');
}

function renderIamSection(m) {
  const lines = ['# --- Step C: bind runtime SA to read each secret ---', ''];
  for (const s of m.secrets) {
    lines.push(`gcloud secrets add-iam-policy-binding ${s.name} \\`);
    lines.push(`  --project=${m.project} \\`);
    lines.push(`  --member="serviceAccount:${m.runtimeServiceAccount}" \\`);
    lines.push(`  --role="roles/secretmanager.secretAccessor"`);
    lines.push('');
  }
  return lines.join('\n');
}

function renderVerifySection(manifestRelPath) {
  return [
    '# --- Step D: verify ---',
    '# After running A + B + C, run:',
    `#   node scripts/deploy/preflight-secrets.mjs --manifest=${manifestRelPath} --strict-project`,
    '# Exit 0 means the manifest is satisfied; HOST-004 deploy can proceed.',
    '',
  ].join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  if (!args.manifest) {
    refuse(5, '--manifest=<path> is required');
  }
  const abs = resolveManifestPath(args.manifest);
  if (!existsSync(abs)) {
    refuse(2, `manifest not found: ${args.manifest}`);
  }
  const manifest = readManifest(abs);
  validateManifestShape(manifest);
  scanForbiddenNames(manifest);
  scanValueShapes(manifest);

  // Render. Stdout only; no file writes.
  const out = [];
  out.push(renderHeader(args.manifest, manifest));
  out.push(renderCreateSection(manifest));
  if (args.includeVersionsAdd) out.push(renderVersionsAddSection(manifest));
  if (args.includeIamBinding) out.push(renderIamSection(manifest));
  out.push(renderVerifySection(args.manifest));

  process.stdout.write(out.join('\n'));
  process.exit(0);
}

main();
