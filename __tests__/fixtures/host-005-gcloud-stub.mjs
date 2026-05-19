#!/usr/bin/env node
// HOST-005 - test stub for `gcloud`. The preflight script accepts
// --gcloud-bin=<path> for test-only injection; this stub answers the exact
// subcommands the helper uses, driven by HOST_005_STUB_* env vars.
//
// Recognized subcommands:
//   gcloud --version
//   gcloud config get-value project
//   gcloud secrets describe <NAME> --project=<PROJECT> --format=json
//   gcloud secrets versions list <NAME> --project=<PROJECT> --filter=state=ENABLED --format=value(name) --limit=1
//   gcloud secrets get-iam-policy <NAME> --project=<PROJECT> --format=json
//
// HOST_005_STUB_PROJECT       - returns this string for `config get-value project`.
//                               Default: cdiscourse-host
// HOST_005_STUB_VERSION_EXIT  - exit code for `--version`. Default: 0.
// HOST_005_STUB_MISSING       - comma-separated names that "do not exist".
// HOST_005_STUB_NO_ENABLED    - comma-separated names with zero ENABLED versions.
// HOST_005_STUB_NO_IAM        - comma-separated names with no runtime binding.
// HOST_005_STUB_RUNTIME_SA    - the runtime SA email to embed in IAM policy.
//                               Default: cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com
//
// All output is to stdout; non-zero exit goes through process.exit.

const args = process.argv.slice(2);

function envList(name) {
  return new Set((process.env[name] || '').split(',').map((s) => s.trim()).filter(Boolean));
}

function write(s, code = 0) {
  process.stdout.write(s);
  process.exit(code);
}

function err(s, code) {
  process.stderr.write(s);
  process.exit(code);
}

const subcmd = args.join(' ');

if (args[0] === '--version') {
  const exit = parseInt(process.env.HOST_005_STUB_VERSION_EXIT || '0', 10);
  if (exit !== 0) {
    process.stderr.write('stub: simulated --version failure\n');
    process.exit(exit);
  }
  write('Google Cloud SDK stub 0.0.0\n');
}

if (args[0] === 'config' && args[1] === 'get-value' && args[2] === 'project') {
  const proj = process.env.HOST_005_STUB_PROJECT == null ? 'cdiscourse-host' : process.env.HOST_005_STUB_PROJECT;
  write(`${proj}\n`);
}

if (args[0] === 'secrets' && args[1] === 'describe') {
  const name = args[2];
  const missing = envList('HOST_005_STUB_MISSING');
  if (missing.has(name)) {
    err(`ERROR: (gcloud.secrets.describe) NOT_FOUND: Secret [projects/_/secrets/${name}] was not found.\n`, 1);
  }
  write(`{"name":"projects/0/secrets/${name}"}\n`);
}

if (args[0] === 'secrets' && args[1] === 'versions' && args[2] === 'list') {
  const name = args[3];
  const noEnabled = envList('HOST_005_STUB_NO_ENABLED');
  if (noEnabled.has(name)) {
    write('');
  } else {
    write('1\n');
  }
}

if (args[0] === 'secrets' && args[1] === 'get-iam-policy') {
  const name = args[2];
  const noIam = envList('HOST_005_STUB_NO_IAM');
  const runtimeSa = process.env.HOST_005_STUB_RUNTIME_SA
    || 'cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com';
  if (noIam.has(name)) {
    write('{"bindings":[]}\n');
  } else {
    const policy = {
      bindings: [
        { role: 'roles/secretmanager.secretAccessor', members: [`serviceAccount:${runtimeSa}`] },
      ],
    };
    write(`${JSON.stringify(policy)}\n`);
  }
}

err(`stub: unhandled subcommand: ${subcmd}\n`, 64);
