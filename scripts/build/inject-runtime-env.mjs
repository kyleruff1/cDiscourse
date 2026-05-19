#!/usr/bin/env node
// HOST-001 — Write dist/runtime-env.js so the Expo Web bundle can read
// EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY at runtime.
//
// The bundle reads window.__CDISCOURSE_RUNTIME_ENV__ first (web), falling back
// to process.env (native + local dev). See src/lib/supabase.ts.
//
// Inputs:
//   - process.env.EXPO_PUBLIC_SUPABASE_URL (required at runtime)
//   - process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (required at runtime)
//   - process.env.EXPO_PUBLIC_APP_ORIGIN (QOL-023; optional)
//   - --url=<url>            CLI override (preferred for local invocations)
//   - --publishable-key=<key> CLI override (preferred for local invocations)
//   - --app-origin=<url>     CLI override for EXPO_PUBLIC_APP_ORIGIN (optional)
//   - --dist-dir=dist        Output directory (default: dist)
//   - --dry                  Plan only; do not write file
//
// Doctrine:
//   - Does NOT read .env* files. Operator passes values via env vars (Cloud Run
//     does this from Secret Manager) or via explicit --url / --publishable-key
//     flags for local invocations.
//   - Never logs the values. Logs only "loaded 2/2" or "missing X".
//   - Refuses if either value carries a long-form secret shape that does NOT
//     match a Supabase URL / publishable-key shape (defence in depth).
//   - Refuses if the dist directory does not exist (build must run first).

import { writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(__filename, '..', '..', '..');

function parseArgs(argv) {
  const out = { url: '', publishableKey: '', appOrigin: '', distDir: 'dist', dry: false };
  for (const arg of argv) {
    if (arg === '--dry' || arg === '--dry-run') out.dry = true;
    else if (arg.startsWith('--url=')) out.url = arg.slice('--url='.length);
    else if (arg.startsWith('--publishable-key=')) out.publishableKey = arg.slice('--publishable-key='.length);
    else if (arg.startsWith('--app-origin=')) out.appOrigin = arg.slice('--app-origin='.length);
    else if (arg.startsWith('--dist-dir=')) out.distDir = arg.slice('--dist-dir='.length);
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
      'inject-runtime-env.mjs — write <dist>/runtime-env.js for the SPA.',
      '',
      'Flags:',
      '  --url=<url>                  EXPO_PUBLIC_SUPABASE_URL value.',
      '  --publishable-key=<key>      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY value.',
      '  --app-origin=<url>           EXPO_PUBLIC_APP_ORIGIN value (optional).',
      '  --dist-dir=<path>            Output directory (default: dist).',
      '  --dry / --dry-run            Plan only. Do not write file.',
      '  --help / -h                  Show this help.',
      '',
      'Resolution order: CLI flag, then process.env. Never reads .env files.',
      'Values are never echoed to stdout. Logs report only counts and presence.',
      '',
    ].join('\n'),
  );
}

// Reject obvious cross-env contamination. These shapes do NOT belong in a
// publishable key OR a Supabase URL. We refuse rather than write them out.
const FORBIDDEN_SHAPES = [
  // sk-ant-* Anthropic key — never bound to Cloud Run.
  new RegExp('\\bsk' + '-ant-'),
  // xai-* xAI key — never bound to Cloud Run.
  new RegExp('\\bxai' + '-'),
  // sb_secret_* Supabase service-role / secret keys — never bound to Cloud Run.
  new RegExp('\\bsb' + '_secret' + '_'),
  // X bearer tokens / generic OAuth bearers — never bound to Cloud Run.
  new RegExp('Bearer\\s+'),
  // SUPABASE_SERVICE_ROLE_KEY string literal accidentally pasted into a value.
  /SUPABASE_SERVICE_ROLE_KEY/,
  /service_role/,
];

function looksForbidden(value) {
  if (!value) return false;
  return FORBIDDEN_SHAPES.some((re) => re.test(value));
}

function looksLikeSupabaseUrl(value) {
  // Defence in depth: a Supabase URL is https://<ref>.supabase.co or a custom
  // domain. We do not pin to .supabase.co (custom domains are valid), but we
  // require it to look like an https URL.
  return /^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/.*)?$/.test(value);
}

function looksLikePublishableKey(value) {
  // Supabase publishable / anon keys are JWT-shaped (eyJ...) OR new-style
  // `sb_publishable_` prefix. Either is acceptable. The point is that they
  // are NOT service-role and NOT another provider's key.
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true;
  if (/^eyJ[A-Za-z0-9_.-]{10,}$/.test(value)) return true;
  return false;
}

// QOL-023 — EXPO_PUBLIC_APP_ORIGIN must look like a bare http(s) origin.
// http is accepted because a hosted-but-local preview may inject
// http://localhost:8081; the helper (buildAuthRedirectUrl) still enforces
// https-in-prod. The injector only refuses garbage.
function looksLikeHttpOrigin(value) {
  return /^https?:\/\/[A-Za-z0-9.-]+(?::\d+)?\/?$/.test(value);
}

function refuseEscape(repoRoot, target) {
  const absolute = resolve(repoRoot, target);
  if (!absolute.startsWith(repoRoot + sep) && absolute !== repoRoot) {
    process.stderr.write(`refused: dist-dir resolves outside repo root: ${absolute}\n`);
    process.exit(2);
  }
  return absolute;
}

// Build the file body. The values are JSON-encoded so injection-prone
// characters (`<`, `'`, etc.) cannot escape the string context.
// QOL-023: EXPO_PUBLIC_APP_ORIGIN is optional — the key is included only when
// a non-empty value is present, so the emitted object stays minimal.
export function buildRuntimeEnvFileContents({ url, publishableKey, appOrigin }) {
  const env = {
    EXPO_PUBLIC_SUPABASE_URL: url,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  };
  if (appOrigin) {
    env.EXPO_PUBLIC_APP_ORIGIN = appOrigin;
  }
  const payload = JSON.stringify(env);
  return (
    '// HOST-001 runtime-env shim. Written at container start; not committed.\n' +
    '// Read by src/lib/supabase.ts via window.__CDISCOURSE_RUNTIME_ENV__.\n' +
    `window.__CDISCOURSE_RUNTIME_ENV__ = Object.freeze(${payload});\n`
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const url = (args.url || process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
  const key = (args.publishableKey || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '').trim();
  const appOrigin = (args.appOrigin || process.env.EXPO_PUBLIC_APP_ORIGIN || '').trim();

  const have = { url: Boolean(url), key: Boolean(key) };
  process.stdout.write(
    `[inject-runtime-env] loaded ${(have.url ? 1 : 0) + (have.key ? 1 : 0)}/2 ` +
      `(url=${have.url ? 'present' : 'missing'}, publishable-key=${have.key ? 'present' : 'missing'}, ` +
      `app-origin=${appOrigin ? 'present' : 'absent'})\n`,
  );

  if (!have.url || !have.key) {
    process.stderr.write(
      '[inject-runtime-env] refused: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are both required.\n',
    );
    return 4;
  }

  if (looksForbidden(url) || looksForbidden(key) || looksForbidden(appOrigin)) {
    process.stderr.write(
      '[inject-runtime-env] refused: a value carries a forbidden secret shape (service-role / Anthropic / xAI / Bearer). Cloud Run binding must use the publishable key, not service-role.\n',
    );
    return 5;
  }

  if (!looksLikeSupabaseUrl(url)) {
    process.stderr.write(
      '[inject-runtime-env] refused: EXPO_PUBLIC_SUPABASE_URL does not look like an https URL.\n',
    );
    return 6;
  }

  if (!looksLikePublishableKey(key)) {
    process.stderr.write(
      '[inject-runtime-env] refused: EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY does not match a Supabase publishable / anon key shape.\n',
    );
    return 7;
  }

  // QOL-023 — EXPO_PUBLIC_APP_ORIGIN is OPTIONAL. When absent the file is
  // written without the key and the helper's fallback covers it. When present
  // it must look like a bare http(s) origin.
  if (appOrigin && !looksLikeHttpOrigin(appOrigin)) {
    process.stderr.write(
      '[inject-runtime-env] refused: EXPO_PUBLIC_APP_ORIGIN does not look like a bare http(s) origin.\n',
    );
    return 10;
  }

  const distAbs = refuseEscape(REPO_ROOT, args.distDir);

  if (args.dry) {
    process.stdout.write(`[inject-runtime-env] mode: dry-run (plan only)\n`);
    process.stdout.write(`[inject-runtime-env] would write: ${join(distAbs, 'runtime-env.js')}\n`);
    return 0;
  }

  if (!existsSync(distAbs) || !statSync(distAbs).isDirectory()) {
    // Cloud Run path: dist exists in the image already. Local path: the
    // operator must have run build-web first. Refuse rather than silently
    // create an empty dist directory.
    process.stderr.write(
      `[inject-runtime-env] refused: dist directory does not exist: ${distAbs}\n` +
        '  Run npm run web:build before injecting the runtime env.\n',
    );
    return 8;
  }

  const target = join(distAbs, 'runtime-env.js');
  // Best-effort dir guarantee for safety (no-op if already there).
  mkdirSync(distAbs, { recursive: true });
  writeFileSync(target, buildRuntimeEnvFileContents({ url, publishableKey: key, appOrigin }), 'utf8');
  process.stdout.write(`[inject-runtime-env] wrote ${target}\n`);
  return 0;
}

// Only run main when invoked directly. Tests import `buildRuntimeEnvFileContents`.
const invokedDirectly = (() => {
  try {
    return resolve(process.argv[1] ?? '') === __filename;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  process.exit(main());
}
