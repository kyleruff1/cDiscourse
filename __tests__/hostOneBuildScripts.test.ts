/**
 * HOST-001 — Build / runtime script contracts + operator runbook structure.
 *
 * Locks the behaviour of:
 *   - scripts/build/build-web.{mjs,ps1,sh}
 *   - scripts/build/inject-runtime-env.{mjs,ps1,sh}
 *   - scripts/runtime/server.mjs
 *   - docs/deployment/host-001-operator-runbook.md (23 numbered steps)
 *
 * The Jest tests also exercise the dry-run code paths of the Node entrypoints
 * (the .mjs files) so we know the validators refuse on forbidden inputs.
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

const REPO_ROOT = process.cwd();

function readFile(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}
function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(REPO_ROOT, rel));
}
function runNode(script: string, args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [path.join(REPO_ROOT, script), ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env } as NodeJS.ProcessEnv,
    encoding: 'utf8',
  });
}

describe('build-web — shell wrappers + Node entrypoint exist', () => {
  it('all three platforms have a build-web wrapper', () => {
    expect(fileExists('scripts/build/build-web.mjs')).toBe(true);
    expect(fileExists('scripts/build/build-web.ps1')).toBe(true);
    expect(fileExists('scripts/build/build-web.sh')).toBe(true);
  });

  it('all three wrappers default the output directory to dist', () => {
    expect(readFile('scripts/build/build-web.mjs')).toMatch(/outputDir:\s*'dist'/);
    expect(readFile('scripts/build/build-web.ps1')).toMatch(/\$OutputDir\s*=\s*'dist'/);
    expect(readFile('scripts/build/build-web.sh')).toMatch(/OUTPUT_DIR="dist"/);
  });

  it('all three wrappers support --dry', () => {
    expect(readFile('scripts/build/build-web.mjs')).toMatch(/'--dry'/);
    expect(readFile('scripts/build/build-web.ps1')).toMatch(/\[switch\]\s*\$DryRun/);
    expect(readFile('scripts/build/build-web.sh')).toMatch(/--dry\|--dry-run\)/);
  });

  it('all three wrappers refuse output-dir paths that escape the repo root', () => {
    expect(readFile('scripts/build/build-web.mjs')).toMatch(/outside repo root/);
    expect(readFile('scripts/build/build-web.ps1')).toMatch(/outside repo root/);
    expect(readFile('scripts/build/build-web.sh')).toMatch(/outside repo root/);
  });

  it('build-web.mjs --dry exits 0 and does not invoke expo', () => {
    const result = runNode('scripts/build/build-web.mjs', ['--dry']);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/dry-run complete/);
    // Defence in depth: dry mode never spawns expo.
    expect(result.stdout).not.toMatch(/expo export.*\n.*Web Bundling/);
  });

  it('build-web.mjs --dry --output-dir=../outside refuses (exit 2)', () => {
    const result = runNode('scripts/build/build-web.mjs', ['--dry', '--output-dir=../outside']);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/outside repo root/);
  });
});

describe('inject-runtime-env — shell wrappers + Node entrypoint', () => {
  it('all three platforms have an inject-runtime-env wrapper', () => {
    expect(fileExists('scripts/build/inject-runtime-env.mjs')).toBe(true);
    expect(fileExists('scripts/build/inject-runtime-env.ps1')).toBe(true);
    expect(fileExists('scripts/build/inject-runtime-env.sh')).toBe(true);
  });

  it('the Node entrypoint never imports dotenv and never reads a .env file', () => {
    const src = readFile('scripts/build/inject-runtime-env.mjs');
    // Doctrine comments may say "does NOT read .env*"; that's fine. What's
    // forbidden is an actual dotenv require / a readFile of a .env path.
    expect(src).not.toMatch(/require\(['"`]dotenv['"`]\)/);
    expect(src).not.toMatch(/from\s+['"`]dotenv['"`]/);
    expect(src).not.toMatch(/readFile(?:Sync)?\(['"`]\.env/);
    expect(src).not.toMatch(/createReadStream\(['"`]\.env/);
  });

  it('the Node entrypoint refuses forbidden secret shapes', () => {
    const src = readFile('scripts/build/inject-runtime-env.mjs');
    // Match each forbidden shape regex (assembled to avoid the test itself
    // tripping the secret-shape scan).
    expect(src).toMatch(/sk' \+ '-ant-/);
    expect(src).toMatch(/xai' \+ '-/);
    expect(src).toMatch(/sb' \+ '_secret' \+ '_/);
    expect(src).toMatch(/Bearer/);
    expect(src).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('refuses when both env values are missing (exit 4)', () => {
    const result = runNode('scripts/build/inject-runtime-env.mjs', ['--dry'], {
      EXPO_PUBLIC_SUPABASE_URL: '',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
    });
    expect(result.status).toBe(4);
    expect(result.stdout).toMatch(/loaded 0\/2/);
    // Never echoes a missing value (because there is no value to echo).
    expect(result.stdout).not.toMatch(/sk-ant-/);
  });

  it('refuses a forbidden secret shape in the URL slot (exit 5)', () => {
    const result = runNode('scripts/build/inject-runtime-env.mjs', ['--dry'], {
      EXPO_PUBLIC_SUPABASE_URL: 'sk' + '-ant-fake-not-a-url',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    });
    expect(result.status).toBe(5);
    expect(result.stderr).toMatch(/forbidden secret shape/);
    // The forbidden value itself must NOT echo into stdout / stderr.
    expect(result.stdout + result.stderr).not.toMatch(/fake-not-a-url/);
  });

  it('refuses a publishable key that is service-role-shaped (exit 5)', () => {
    const result = runNode('scripts/build/inject-runtime-env.mjs', ['--dry'], {
      EXPO_PUBLIC_SUPABASE_URL: 'https://dev.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb' + '_secret' + '_pasted_by_mistake',
    });
    expect(result.status).toBe(5);
    expect(result.stderr).toMatch(/forbidden secret shape/);
    // Value must not echo to stdout / stderr.
    expect(result.stdout + result.stderr).not.toMatch(/pasted_by_mistake/);
  });

  it('refuses a URL that is not https-shaped (exit 6)', () => {
    const result = runNode('scripts/build/inject-runtime-env.mjs', ['--dry'], {
      EXPO_PUBLIC_SUPABASE_URL: 'ftp://nope',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    });
    expect(result.status).toBe(6);
    expect(result.stderr).toMatch(/does not look like an https URL/);
  });

  it('accepts the sb_publishable_ shape on a valid Supabase URL (dry exits 0)', () => {
    const result = runNode('scripts/build/inject-runtime-env.mjs', ['--dry'], {
      EXPO_PUBLIC_SUPABASE_URL: 'https://dev.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_realistic_value',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/would write/);
  });

  it('accepts the eyJ... JWT shape on a valid Supabase URL (dry exits 0)', () => {
    const result = runNode('scripts/build/inject-runtime-env.mjs', ['--dry'], {
      EXPO_PUBLIC_SUPABASE_URL: 'https://dev.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOi-shape-not-a-real-key',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/would write/);
  });

  it('the runtime-env.js shim contents bind both EXPO_PUBLIC_ keys with JSON-encoded values', () => {
    // Source-scan the entrypoint to confirm the shim builder emits both
    // required keys and JSON-encodes the payload (so injection-prone
    // characters cannot escape the string context).
    // QOL-023: the builder now assembles an `env` object — including the
    // optional EXPO_PUBLIC_APP_ORIGIN key only when present — and then calls
    // JSON.stringify(env). Both required keys still appear in that object.
    const src = readFile('scripts/build/inject-runtime-env.mjs');
    expect(src).toMatch(/EXPO_PUBLIC_SUPABASE_URL[\s\S]*?EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
    expect(src).toMatch(/JSON\.stringify\(env\)/);
    expect(src).toMatch(/window\.__CDISCOURSE_RUNTIME_ENV__\s*=\s*Object\.freeze/);
  });
});

describe('runtime server.mjs — single-process Cloud Run entrypoint', () => {
  let src = '';
  beforeAll(() => {
    src = readFile('scripts/runtime/server.mjs');
  });

  it('exists', () => {
    expect(fileExists('scripts/runtime/server.mjs')).toBe(true);
  });

  it('listens on $PORT (default 8080)', () => {
    expect(src).toMatch(/Number\(process\.env\.PORT\)\s*\|\|\s*8080/);
  });

  it('refuses to start when env vars are missing (exit 4)', () => {
    expect(src).toMatch(/process\.exit\(4\)/);
    expect(src).toMatch(/EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });

  it('refuses forbidden secret shapes (exit 5)', () => {
    expect(src).toMatch(/process\.exit\(5\)/);
    expect(src).toMatch(/forbidden secret shape/);
  });

  it('refuses when dist/ is missing (exit 6)', () => {
    expect(src).toMatch(/process\.exit\(6\)/);
    expect(src).toMatch(/dist directory not found/);
  });

  it('spawns the vendored serve CLI with -s SPA fallback', () => {
    expect(src).toMatch(/node_modules.*serve.*main\.js/);
    expect(src).toMatch(/'-s',/);
    expect(src).toMatch(/'--no-clipboard'/);
  });

  it('never logs the values of the two env vars (presence only)', () => {
    // The string fragment "url='" or value templating from these specific
    // vars must not appear; we accept "url=present" / "url=missing" strings.
    expect(src).not.toMatch(/EXPO_PUBLIC_SUPABASE_URL=\$\{/);
    expect(src).not.toMatch(/console\.log\(.*EXPO_PUBLIC_SUPABASE/);
  });

  it('never reads service-role / Anthropic / xAI / Resend keys from process.env', () => {
    // server.mjs has these tokens in its forbidden-shape regex (defense in
    // depth) — that is intentional. What's forbidden is *reading* the value
    // via process.env.NAME or *binding* it. Assert neither happens.
    expect(src).not.toMatch(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
    expect(src).not.toMatch(/process\.env\.ANTHROPIC_API_KEY/);
    expect(src).not.toMatch(/process\.env\.XAI_API_KEY/);
    expect(src).not.toMatch(/process\.env\.X_BEARER_TOKEN/);
    expect(src).not.toMatch(/process\.env\.RESEND_API_KEY/);
  });

  it('handles SIGTERM + SIGINT for graceful Cloud Run shutdown', () => {
    expect(src).toMatch(/SIGTERM/);
    expect(src).toMatch(/SIGINT/);
  });
});

describe('operator runbook — 23 numbered steps, self-contained', () => {
  const runbookPath = 'docs/deployment/host-001-operator-runbook.md';
  let src = '';
  beforeAll(() => {
    src = readFile(runbookPath);
  });

  it('exists', () => {
    expect(fileExists(runbookPath)).toBe(true);
  });

  it('contains the 23 numbered top-level steps', () => {
    // Match lines that start with `1.`, `2.`, ... up to `23.` (with optional
    // leading whitespace; markdown allows indentation).
    const stepNumbers = new Set<number>();
    for (const line of src.split('\n')) {
      const m = line.match(/^\s*(\d{1,2})\.\s+\*\*/);
      if (m) stepNumbers.add(Number(m[1]));
    }
    for (let i = 1; i <= 23; i += 1) {
      expect(stepNumbers.has(i)).toBe(true);
    }
  });

  it('never echoes a literal <VALUE> placeholder (use named placeholders instead)', () => {
    // Operators copy-paste; <VALUE> is too anonymous. Named placeholders are OK.
    expect(src).not.toMatch(/<VALUE>/);
  });

  it('explicitly labels the OPERATOR_EMAIL placeholder', () => {
    expect(src).toMatch(/<OPERATOR_EMAIL>/);
  });

  it('marks gcloud / docker steps as operator-run', () => {
    expect(src.toLowerCase()).toMatch(/operator runs/);
    expect(src.toLowerCase()).toMatch(/agent does not run/);
  });

  it('references the master plan §11 cross-link', () => {
    expect(src).toMatch(/google-cloud-run-hosting-plan\.md/);
  });

  it('never references SUPABASE_SERVICE_ROLE_KEY / ANTHROPIC_API_KEY / XAI_API_KEY / RESEND_API_KEY', () => {
    // These keys must never appear in a Cloud Run binding section.
    expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(src).not.toMatch(/ANTHROPIC_API_KEY/);
    expect(src).not.toMatch(/XAI_API_KEY/);
    expect(src).not.toMatch(/RESEND_API_KEY/);
  });
});

describe('serve dependency — exact-pinned in package.json', () => {
  it('package.json declares serve at an exact version (no ^ / ~ / x prefix)', () => {
    const pkg = JSON.parse(readFile('package.json')) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies).toBeDefined();
    const serveVersion = pkg.dependencies?.serve;
    expect(serveVersion).toBeDefined();
    expect(serveVersion).toMatch(/^14\.\d+\.\d+$/);
    expect(serveVersion).not.toMatch(/^[\^~]/);
  });

  it('package.json declares the web:build + web:build:dry scripts', () => {
    const pkg = JSON.parse(readFile('package.json')) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.['web:build']).toMatch(/expo export --platform web/);
    expect(pkg.scripts?.['web:build:dry']).toMatch(/scripts\/build\/build-web\.mjs/);
  });
});
