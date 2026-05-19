#!/usr/bin/env node
// HOST-001 — Container entrypoint for the Cloud Run runtime stage.
//
// Pipeline (single Node process, no shell in distroless):
//   1. Read EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
//      from process.env (set by Cloud Run via --set-secrets=).
//   2. Refuse to start (exit non-zero) if either is missing or carries a
//      forbidden secret shape. Cloud Run will mark the revision unhealthy.
//   3. Write dist/runtime-env.js so the SPA can read window.__CDISCOURSE_RUNTIME_ENV__.
//   4. Spawn `serve` (vendored from node_modules, pinned in package.json) with
//      the `-s` SPA-fallback flag on $PORT (default 8080).
//   5. Never log the values of the two env vars. Logs presence only.
//
// Doctrine:
//   - No env-file reads. Process env only.
//   - No outbound network calls.
//   - No service-role / Anthropic / xAI / X / Resend references.
//   - No verdict copy.

import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

// In the runtime image WORKDIR is /app and server.mjs is at /app/server.mjs.
// dist/ lives at /app/dist. node_modules/.bin/serve is the vendored CLI.
function resolveDistDir() {
  const candidates = [
    resolve(__filename, '..', 'dist'),
    resolve(__filename, '..', '..', 'dist'),
    resolve(__filename, '..', '..', '..', 'dist'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Fail closed: return the first candidate; existence check below catches it.
  return candidates[0];
}

function resolveServeCli() {
  const candidates = [
    resolve(__filename, '..', 'node_modules', 'serve', 'build', 'main.js'),
    resolve(__filename, '..', '..', 'node_modules', 'serve', 'build', 'main.js'),
    resolve(__filename, '..', '..', '..', 'node_modules', 'serve', 'build', 'main.js'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

const DIST_DIR = resolveDistDir();
const PORT = Number(process.env.PORT) || 8080;

// Forbidden secret shapes — defence in depth. The values bound here MUST be
// the publishable / anon key + the URL. Anything else is misconfiguration.
const FORBIDDEN_SHAPES = [
  new RegExp('\\bsk' + '-ant-'),
  new RegExp('\\bxai' + '-'),
  new RegExp('\\bsb' + '_secret' + '_'),
  new RegExp('Bearer\\s+'),
  /SUPABASE_SERVICE_ROLE_KEY/,
  /service_role/,
];

function looksForbidden(value) {
  if (!value) return false;
  return FORBIDDEN_SHAPES.some((re) => re.test(value));
}

// QOL-023: EXPO_PUBLIC_APP_ORIGIN is optional — the key is included only when
// a non-empty value is present.
function buildRuntimeEnvFileContents({ url, publishableKey, appOrigin }) {
  const env = {
    EXPO_PUBLIC_SUPABASE_URL: url,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
  };
  if (appOrigin) {
    env.EXPO_PUBLIC_APP_ORIGIN = appOrigin;
  }
  const payload = JSON.stringify(env);
  return (
    '// HOST-001 runtime-env shim. Written at container start.\n' +
    '// Read by src/lib/supabase.ts via window.__CDISCOURSE_RUNTIME_ENV__.\n' +
    `window.__CDISCOURSE_RUNTIME_ENV__ = Object.freeze(${payload});\n`
  );
}

function preflight() {
  const url = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
  const key = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '').trim();
  // QOL-023 — EXPO_PUBLIC_APP_ORIGIN is OPTIONAL. Its absence must NOT fail the
  // 2/2 required-value check; that check stays scoped to the two Supabase keys.
  const appOrigin = (process.env.EXPO_PUBLIC_APP_ORIGIN || '').trim();
  const have = { url: Boolean(url), key: Boolean(key) };
  process.stdout.write(
    '[server] env loaded ' +
      `${(have.url ? 1 : 0) + (have.key ? 1 : 0)}/2 ` +
      `(url=${have.url ? 'present' : 'missing'}, ` +
      `publishable-key=${have.key ? 'present' : 'missing'}, ` +
      `app-origin=${appOrigin ? 'present' : 'absent'})\n`,
  );

  if (!have.url || !have.key) {
    process.stderr.write(
      '[server] refused: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are both required.\n',
    );
    process.exit(4);
  }
  if (looksForbidden(url) || looksForbidden(key) || looksForbidden(appOrigin)) {
    process.stderr.write(
      '[server] refused: a bound value carries a forbidden secret shape (service-role / Anthropic / xAI / Bearer / app-origin).\n',
    );
    process.exit(5);
  }
  if (!existsSync(DIST_DIR) || !statSync(DIST_DIR).isDirectory()) {
    process.stderr.write(`[server] refused: dist directory not found: ${DIST_DIR}\n`);
    process.exit(6);
  }
  mkdirSync(DIST_DIR, { recursive: true });
  writeFileSync(
    join(DIST_DIR, 'runtime-env.js'),
    buildRuntimeEnvFileContents({ url, publishableKey: key, appOrigin }),
    'utf8',
  );
  process.stdout.write(`[server] wrote runtime-env.js into ${DIST_DIR}\n`);
}

function main() {
  preflight();

  const serveCli = resolveServeCli();
  if (!serveCli) {
    process.stderr.write(
      '[server] refused: vendored serve CLI not found. Image must include node_modules/serve from the builder stage.\n',
    );
    process.exit(7);
  }

  // serve flags (vercel/serve@14):
  //   -s         single-page app fallback (any unknown path → index.html)
  //   -l <port>  listen address
  //   --no-clipboard / --no-port-switching keep boot deterministic in containers.
  const args = [
    serveCli,
    '-s',
    DIST_DIR,
    '-l',
    String(PORT),
    '--no-clipboard',
    '--no-port-switching',
  ];

  process.stdout.write(`[server] starting serve on :${PORT} (dist=${DIST_DIR})\n`);

  const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    env: process.env,
  });

  function shutdown(signal) {
    process.stdout.write(`[server] received ${signal}, forwarding to serve\n`);
    try {
      child.kill(signal);
    } catch {
      // ignore
    }
    setTimeout(() => process.exit(0), 5000).unref();
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  child.on('exit', (code, signal) => {
    process.stdout.write(`[server] serve exited code=${code ?? 'null'} signal=${signal ?? 'null'}\n`);
    process.exit(code ?? 0);
  });
}

main();
