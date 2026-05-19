#!/usr/bin/env node
// HOST-005 - Preflight that confirms every secret named in the manifest exists
// in Google Secret Manager with at least one ENABLED version and (optionally)
// that the runtime service account has the secretAccessor binding.
//
// Doctrine:
//   - NEVER calls `gcloud secrets versions access` (which would read a value).
//     The source-scan test enforces this.
//   - Only invokes: `gcloud --version`, `gcloud config get-value project`,
//     `gcloud secrets describe`, `gcloud secrets versions list`,
//     `gcloud secrets get-iam-policy`.
//   - NEVER reads `.env*` files.
//   - The helper runs `child_process.spawnSync('gcloud', ...)` -- this is the
//     one place where the helper does invoke gcloud, because preflight is the
//     "verify the operator already did the work" step. It still never reads a
//     secret value.
//   - --strict-project refuses if `gcloud config get-value project` does not
//     equal `manifest.project`. Default behaviour without the flag is to emit
//     a warning to stderr and proceed.
//
// Exit codes:
//   0  all manifest secrets exist with state=ENABLED (and IAM binding if checked)
//   2  manifest parse / schema validation failed
//   3  gcloud not on PATH
//   4  gcloud project mismatch with --strict-project
//   5  at least one secret has no state=ENABLED version
//   6  at least one secret does not exist at all
//   7  gcloud subprocess returned non-zero (auth / API not enabled / network)

import { readFileSync, existsSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(__filename, '..', '..', '..');

const REQUIRED_ENV_VAR_PREFIX = 'EXPO_PUBLIC_';

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

const VALUE_SHAPE_PATTERNS = [
  /\bsk-ant-/i,
  /\bxai-[A-Za-z0-9_]/i,
  /\bsb_secret_/i,
  /\bsb_publishable_/i,
  /\beyJ[A-Za-z0-9_.-]{10,}/,
  /\bBearer\s+[A-Za-z0-9_.-]/,
  /https?:\/\/[A-Za-z0-9-]+\.supabase\.co/i,
];

function parseArgs(argv) {
  const out = {
    manifest: '',
    project: '',
    strictProject: false,
    noStrictProject: false,
    json: false,
    gcloudBin: 'gcloud',
    checkIam: true,
  };
  for (const arg of argv) {
    if (arg.startsWith('--manifest=')) out.manifest = arg.slice('--manifest='.length);
    else if (arg.startsWith('--project=')) out.project = arg.slice('--project='.length);
    else if (arg === '--strict-project') out.strictProject = true;
    else if (arg === '--no-strict-project') out.noStrictProject = true;
    else if (arg === '--json') out.json = true;
    else if (arg.startsWith('--gcloud-bin=')) out.gcloudBin = arg.slice('--gcloud-bin='.length);
    else if (arg === '--no-check-iam') out.checkIam = false;
    else if (arg === '--check-iam') out.checkIam = true;
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
      'preflight-secrets.mjs - verify manifest secrets exist + have ENABLED versions.',
      '',
      'Flags:',
      '  --manifest=<path>          Required.',
      '  --project=<id>             Override gcloud config get-value project.',
      '  --strict-project           Refuse if gcloud project != manifest.project (exit 4).',
      '  --no-strict-project        Warn (default) instead of refuse on project mismatch.',
      '  --json                     Emit JSON result to stdout.',
      '  --no-check-iam             Skip the IAM binding check.',
      '  --gcloud-bin=<path>        Override gcloud binary (test-only).',
      '  --help / -h                Show this help.',
      '',
      'Doctrine: never calls `gcloud secrets versions access`. Never reads .env files.',
      '',
    ].join('\n'),
  );
}

function refuse(exitCode, message) {
  process.stderr.write(`${message}\n`);
  process.exit(exitCode);
}

function warn(message) {
  process.stderr.write(`warning: ${message}\n`);
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
  try {
    return JSON.parse(raw);
  } catch (err) {
    refuse(2, `manifest parse failed: ${err.message}`);
  }
  return null;
}

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
    if (!s.cloudRunEnvVar.startsWith(REQUIRED_ENV_VAR_PREFIX)) {
      refuse(2, `secrets[${i}].cloudRunEnvVar must start with ${REQUIRED_ENV_VAR_PREFIX}`);
    }
    if (!s.consumerFile.startsWith('src/')) {
      refuse(2, `secrets[${i}].consumerFile must start with src/`);
    }
    if (seenNames.has(s.name)) refuse(2, `duplicate secret name: ${s.name}`);
    if (seenEnvVars.has(s.cloudRunEnvVar)) refuse(2, `duplicate cloudRunEnvVar: ${s.cloudRunEnvVar}`);
    seenNames.add(s.name);
    seenEnvVars.add(s.cloudRunEnvVar);
    const tok = matchesForbiddenToken(s.name);
    if (tok) refuse(2, `secrets[${i}].name forbidden token: ${tok}`);
  }
  visitStrings(m, '', (p, v) => {
    const hit = matchesValueShape(v);
    if (hit) refuse(2, `value-shape literal at ${p}`);
  });
}

function runGcloud(bin, args) {
  // Test-only support: if the bin path ends in .mjs / .js, invoke via node so
  // a Node-based stub script can stand in for the real `gcloud` binary on
  // platforms (e.g. Windows) where direct file execution does not honor the
  // shebang. In production, --gcloud-bin defaults to the literal "gcloud" and
  // this branch never fires.
  if (typeof bin === 'string' && /\.(mjs|js|cjs)$/i.test(bin)) {
    return spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
  }
  return spawnSync(bin, args, { encoding: 'utf8' });
}

function checkGcloudOnPath(bin) {
  const r = runGcloud(bin, ['--version']);
  if (r.error || r.status !== 0) {
    refuse(3, `gcloud not on PATH or returned non-zero from --version: ${r.error ? r.error.message : `exit ${r.status}`}`);
  }
}

function getGcloudProject(bin) {
  const r = runGcloud(bin, ['config', 'get-value', 'project']);
  if (r.status !== 0) return null;
  return (r.stdout || '').trim();
}

function describeSecret(bin, name, project) {
  return runGcloud(bin, ['secrets', 'describe', name, `--project=${project}`, '--format=json']);
}

function listEnabledVersions(bin, name, project) {
  return runGcloud(bin, [
    'secrets',
    'versions',
    'list',
    name,
    `--project=${project}`,
    '--filter=state=ENABLED',
    `--format=value(name)`,
    '--limit=1',
  ]);
}

function getSecretIamPolicy(bin, name, project) {
  return runGcloud(bin, ['secrets', 'get-iam-policy', name, `--project=${project}`, '--format=json']);
}

function hasAccessorBinding(policyJson, runtimeServiceAccount) {
  try {
    const policy = JSON.parse(policyJson);
    if (!policy || !Array.isArray(policy.bindings)) return false;
    for (const b of policy.bindings) {
      if (b.role !== 'roles/secretmanager.secretAccessor') continue;
      if (!Array.isArray(b.members)) continue;
      for (const m of b.members) {
        if (m === `serviceAccount:${runtimeServiceAccount}`) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  if (!args.manifest) {
    refuse(5, '--manifest=<path> is required');
  }
  const abs = resolveManifestPath(args.manifest);
  if (!existsSync(abs)) refuse(2, `manifest not found: ${args.manifest}`);
  const manifest = readManifest(abs);
  validateManifestShape(manifest);

  const bin = args.gcloudBin;
  checkGcloudOnPath(bin);

  // Project resolution.
  let project = args.project;
  if (!project) {
    const gcloudProject = getGcloudProject(bin);
    if (gcloudProject == null) {
      refuse(7, 'gcloud config get-value project returned non-zero');
    }
    if (gcloudProject !== manifest.project) {
      if (args.strictProject) {
        refuse(4, `gcloud project "${gcloudProject}" does not match manifest.project "${manifest.project}"`);
      } else {
        if (args.noStrictProject) {
          warn('--no-strict-project: project mismatch ignored (test / probe mode).');
        }
        warn(`gcloud project "${gcloudProject}" != manifest.project "${manifest.project}" -- proceeding without --strict-project`);
      }
    }
    project = manifest.project;
  }

  const result = {
    manifest: args.manifest,
    project,
    checked: [],
    summary: { ok: false, missing: 0, noEnabledVersion: 0, noRuntimeBinding: 0 },
  };

  let worstExit = 0;
  for (const s of manifest.secrets) {
    const entry = {
      name: s.name,
      exists: false,
      enabledVersions: 0,
      hasRuntimeBinding: false,
    };

    const describe = describeSecret(bin, s.name, project);
    if (describe.status === 0) {
      entry.exists = true;
    } else {
      const stderr = (describe.stderr || '').toLowerCase();
      if (stderr.includes('not_found') || stderr.includes('not found') || stderr.includes('was not found')) {
        entry.exists = false;
        result.summary.missing += 1;
        if (worstExit < 6) worstExit = 6;
      } else {
        refuse(7, `gcloud secrets describe ${s.name} failed: ${describe.stderr || `exit ${describe.status}`}`);
      }
    }

    if (entry.exists) {
      const versions = listEnabledVersions(bin, s.name, project);
      if (versions.status === 0) {
        const lines = (versions.stdout || '').split(/\r?\n/).filter((l) => l.trim().length > 0);
        entry.enabledVersions = lines.length;
        if (lines.length === 0) {
          result.summary.noEnabledVersion += 1;
          if (worstExit < 5) worstExit = 5;
        }
      } else {
        refuse(7, `gcloud secrets versions list ${s.name} failed: ${versions.stderr || `exit ${versions.status}`}`);
      }
    }

    if (entry.exists && args.checkIam) {
      const iam = getSecretIamPolicy(bin, s.name, project);
      if (iam.status === 0) {
        entry.hasRuntimeBinding = hasAccessorBinding(iam.stdout || '{}', manifest.runtimeServiceAccount);
        if (!entry.hasRuntimeBinding) {
          result.summary.noRuntimeBinding += 1;
          if (worstExit < 5) worstExit = 5;
        }
      } else {
        refuse(7, `gcloud secrets get-iam-policy ${s.name} failed: ${iam.stderr || `exit ${iam.status}`}`);
      }
    }

    result.checked.push(entry);
  }

  result.summary.ok = worstExit === 0;

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`HOST-005 preflight: manifest=${args.manifest} project=${project}\n`);
    for (const c of result.checked) {
      process.stdout.write(
        `  ${c.name}: exists=${c.exists} enabledVersions=${c.enabledVersions} hasRuntimeBinding=${c.hasRuntimeBinding}\n`,
      );
    }
    process.stdout.write(
      `summary: ok=${result.summary.ok} missing=${result.summary.missing} noEnabledVersion=${result.summary.noEnabledVersion} noRuntimeBinding=${result.summary.noRuntimeBinding}\n`,
    );
  }
  process.exit(worstExit);
}

main();
