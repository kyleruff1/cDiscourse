/**
 * HOST-005 - scripts/deploy/print-secret-commands.{mjs,ps1,sh} contract.
 *
 * Doctrine the helper enforces (all asserted here):
 *   - Refuses if --manifest is missing.
 *   - Refuses on schema violation (exit 2).
 *   - Refuses on forbidden name (exit 3).
 *   - Refuses on value-shape literal in any manifest field (exit 4).
 *   - Default-flag invocation against the real manifest prints both
 *     `gcloud secrets create`, `gcloud secrets versions add --data-file=-`,
 *     and `gcloud secrets add-iam-policy-binding` commands for both secrets.
 *   - Output NEVER contains a value-shape literal.
 *   - Output NEVER substitutes a value on the command line; the stdin path
 *     (`--data-file=-`) is the only allowed value entry.
 *   - Source NEVER reads .env*, NEVER imports dotenv, NEVER spawns gcloud.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

const REPO_ROOT = process.cwd();
const ENTRYPOINT = path.join(REPO_ROOT, 'scripts/deploy/print-secret-commands.mjs');
const MANIFEST = 'infra/secrets/cdiscourse-dev-manifest.json';

function readFile(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}
function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(REPO_ROOT, rel));
}

function run(args: string[]) {
  return spawnSync(process.execPath, [ENTRYPOINT, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

function writeTempManifest(overrides: Record<string, unknown>): string {
  const base = JSON.parse(readFile(MANIFEST));
  const merged = { ...base, ...overrides };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'host005-print-'));
  const p = path.join(dir, 'manifest.json');
  fs.writeFileSync(p, JSON.stringify(merged, null, 2), 'utf8');
  return p;
}

const VALUE_SHAPE_PATTERNS: RegExp[] = [
  new RegExp('\\b' + 'sk' + '-ant-', 'i'),
  new RegExp('\\b' + 'xai' + '-[A-Za-z0-9_]', 'i'),
  new RegExp('\\b' + 'sb' + '_secret' + '_', 'i'),
  new RegExp('\\b' + 'sb' + '_publishable' + '_', 'i'),
  /\beyJ[A-Za-z0-9_.-]{10,}/,
  /\bBearer\s+[A-Za-z0-9_.-]/,
  /https?:\/\/[A-Za-z0-9-]+\.supabase\.co/i,
];

describe('print-secret-commands - file existence', () => {
  it('mjs + ps1 + sh wrappers all exist', () => {
    expect(fileExists('scripts/deploy/print-secret-commands.mjs')).toBe(true);
    expect(fileExists('scripts/deploy/print-secret-commands.ps1')).toBe(true);
    expect(fileExists('scripts/deploy/print-secret-commands.sh')).toBe(true);
  });

  it('ps1 wrapper forwards to the .mjs without re-implementing logic', () => {
    const src = readFile('scripts/deploy/print-secret-commands.ps1');
    expect(src).toMatch(/print-secret-commands\.mjs/);
    expect(src).toMatch(/node\s+\$Entrypoint/);
  });

  it('sh wrapper forwards to the .mjs without re-implementing logic', () => {
    const src = readFile('scripts/deploy/print-secret-commands.sh');
    expect(src).toMatch(/print-secret-commands\.mjs/);
    expect(src).toMatch(/exec node/);
  });
});

describe('print-secret-commands - happy path (real manifest)', () => {
  let stdout: string;
  let stderr: string;
  let status: number | null;

  beforeAll(() => {
    const r = run([`--manifest=${MANIFEST}`]);
    stdout = r.stdout || '';
    stderr = r.stderr || '';
    status = r.status;
  });

  it('exits 0', () => {
    expect(status).toBe(0);
    expect(stderr).toBe('');
  });

  it('emits the two `gcloud secrets create <name>` commands', () => {
    expect(stdout).toMatch(/gcloud secrets create cdiscourse-dev-supabase-url/);
    expect(stdout).toMatch(/gcloud secrets create cdiscourse-dev-supabase-publishable-key/);
  });

  it('emits the two `gcloud secrets versions add <name> --data-file=-` commands', () => {
    expect(stdout).toMatch(/gcloud secrets versions add cdiscourse-dev-supabase-url[\s\S]*?--data-file=-/);
    expect(stdout).toMatch(
      /gcloud secrets versions add cdiscourse-dev-supabase-publishable-key[\s\S]*?--data-file=-/,
    );
  });

  it('emits the two IAM binding commands targeting cdiscourse-dev-runner', () => {
    expect(stdout).toMatch(
      /gcloud secrets add-iam-policy-binding cdiscourse-dev-supabase-url[\s\S]*?serviceAccount:cdiscourse-dev-runner@cdiscourse-host\.iam\.gserviceaccount\.com[\s\S]*?roles\/secretmanager\.secretAccessor/,
    );
    expect(stdout).toMatch(
      /gcloud secrets add-iam-policy-binding cdiscourse-dev-supabase-publishable-key[\s\S]*?serviceAccount:cdiscourse-dev-runner@cdiscourse-host\.iam\.gserviceaccount\.com[\s\S]*?roles\/secretmanager\.secretAccessor/,
    );
  });

  it('output contains the agent-non-execution header', () => {
    expect(stdout).toContain('The agent did NOT run any of these commands.');
  });

  it('output contains both Clear-History (PowerShell) and history -c (bash) guidance', () => {
    expect(stdout).toContain('Clear-History');
    expect(stdout).toContain('history -c');
  });

  it('output never contains a value-shape literal', () => {
    for (const re of VALUE_SHAPE_PATTERNS) {
      expect(stdout).not.toMatch(re);
    }
  });

  it('output never contains a forbidden secret name (service-role / anthropic / xai / bearer / resend)', () => {
    const lower = stdout.toLowerCase();
    for (const tok of [
      'service-role',
      'service_role',
      'anthropic',
      'xai',
      'resend',
      'x-bearer',
      'x_bearer',
      'sb-secret',
      'sb_secret',
    ]) {
      expect(lower.includes(tok)).toBe(false);
    }
  });

  it('output never contains `printf %s` (value pipelined on command line is forbidden)', () => {
    // Parent spec: stdin path via `--data-file=-` is the only allowed value
    // entry. `printf %s "<VALUE>" | gcloud ...` is the forbidden pattern.
    expect(stdout).not.toMatch(/printf\s+%s\b/);
  });

  it('output references the preflight helper for the verify step', () => {
    expect(stdout).toContain('preflight-secrets.mjs');
    expect(stdout).toContain('--strict-project');
  });

  it('output references the locked project + region', () => {
    expect(stdout).toContain('cdiscourse-host');
    expect(stdout).toContain('us-central1');
  });
});

describe('print-secret-commands - refusal paths', () => {
  it('exit 5 when --manifest is missing', () => {
    const r = run([]);
    expect(r.status).toBe(5);
    expect(r.stderr).toMatch(/--manifest/);
    expect(r.stdout).toBe('');
  });

  it('exit 2 when manifest file does not exist', () => {
    const r = run([`--manifest=does/not/exist.json`]);
    expect(r.status).toBe(2);
  });

  it('exit 2 when manifest has wrong project', () => {
    const p = writeTempManifest({ project: 'other-project' });
    const r = run([`--manifest=${p}`]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/project/);
  });

  it('exit 2 when manifest has wrong version', () => {
    const p = writeTempManifest({ version: 2 });
    const r = run([`--manifest=${p}`]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/version/);
  });

  it('exit 2 when a secret has non-EXPO_PUBLIC_ env var (schema constraint)', () => {
    const p = writeTempManifest({
      secrets: [
        {
          name: 'cdiscourse-dev-supabase-url',
          cloudRunEnvVar: 'SOME_OTHER_VAR',
          purpose: 'placeholder reason text',
          consumerFile: 'src/lib/supabase.ts',
        },
      ],
    });
    const r = run([`--manifest=${p}`]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/EXPO_PUBLIC_/);
  });

  it('exit 3 when a secret name contains a forbidden token (anthropic)', () => {
    const p = writeTempManifest({
      secrets: [
        {
          name: 'cdiscourse-dev-anthropic-api-key',
          cloudRunEnvVar: 'EXPO_PUBLIC_PLACEHOLDER',
          purpose: 'placeholder reason text',
          consumerFile: 'src/lib/supabase.ts',
        },
      ],
    });
    const r = run([`--manifest=${p}`]);
    expect(r.status).toBe(3);
    expect(r.stderr).toMatch(/forbidden/);
  });

  it('exit 3 when a secret name contains service-role', () => {
    const p = writeTempManifest({
      secrets: [
        {
          name: 'cdiscourse-dev-service-role-secret',
          cloudRunEnvVar: 'EXPO_PUBLIC_PLACEHOLDER',
          purpose: 'placeholder reason text',
          consumerFile: 'src/lib/supabase.ts',
        },
      ],
    });
    const r = run([`--manifest=${p}`]);
    expect(r.status).toBe(3);
  });

  it('exit 3 when a secret name contains xai', () => {
    const p = writeTempManifest({
      secrets: [
        {
          name: 'cdiscourse-dev-xai-token',
          cloudRunEnvVar: 'EXPO_PUBLIC_PLACEHOLDER',
          purpose: 'placeholder reason text',
          consumerFile: 'src/lib/supabase.ts',
        },
      ],
    });
    const r = run([`--manifest=${p}`]);
    expect(r.status).toBe(3);
  });

  it('exit 3 when a secret name contains bearer', () => {
    const p = writeTempManifest({
      secrets: [
        {
          name: 'cdiscourse-dev-x-bearer-token',
          cloudRunEnvVar: 'EXPO_PUBLIC_PLACEHOLDER',
          purpose: 'placeholder reason text',
          consumerFile: 'src/lib/supabase.ts',
        },
      ],
    });
    const r = run([`--manifest=${p}`]);
    expect(r.status).toBe(3);
  });

  it('exit 3 when a secret name contains resend', () => {
    const p = writeTempManifest({
      secrets: [
        {
          name: 'cdiscourse-dev-resend-api-key',
          cloudRunEnvVar: 'EXPO_PUBLIC_PLACEHOLDER',
          purpose: 'placeholder reason text',
          consumerFile: 'src/lib/supabase.ts',
        },
      ],
    });
    const r = run([`--manifest=${p}`]);
    expect(r.status).toBe(3);
  });

  it('exit 4 when a manifest field contains a JWT-shape literal', () => {
    const p = writeTempManifest({
      secrets: [
        {
          name: 'cdiscourse-dev-supabase-url',
          cloudRunEnvVar: 'EXPO_PUBLIC_SUPABASE_URL',
          // JWT-shape assembled at runtime to avoid the test source itself
          // tripping the scan.
          purpose: 'placeholder ' + 'eyJ' + 'abcdef0123456789'.repeat(2),
          consumerFile: 'src/lib/supabase.ts',
        },
      ],
    });
    const r = run([`--manifest=${p}`]);
    expect(r.status).toBe(4);
    expect(r.stderr).toMatch(/value-shaped/);
  });

  it('exit 4 when a manifest field contains an sk-ant- literal', () => {
    const p = writeTempManifest({
      secrets: [
        {
          name: 'cdiscourse-dev-supabase-url',
          cloudRunEnvVar: 'EXPO_PUBLIC_SUPABASE_URL',
          // Assemble at runtime.
          purpose: 'placeholder ' + 'sk' + '-ant-' + 'AAA',
          consumerFile: 'src/lib/supabase.ts',
        },
      ],
    });
    const r = run([`--manifest=${p}`]);
    expect(r.status).toBe(4);
  });

  it('exit 4 when a manifest field contains a .supabase.co URL literal', () => {
    const p = writeTempManifest({
      secrets: [
        {
          name: 'cdiscourse-dev-supabase-url',
          cloudRunEnvVar: 'EXPO_PUBLIC_SUPABASE_URL',
          purpose: 'placeholder https://abc.supabase.co/rest/v1',
          consumerFile: 'src/lib/supabase.ts',
        },
      ],
    });
    const r = run([`--manifest=${p}`]);
    expect(r.status).toBe(4);
  });

  it('exit 2 when secrets array is empty', () => {
    const p = writeTempManifest({ secrets: [] });
    const r = run([`--manifest=${p}`]);
    expect(r.status).toBe(2);
  });
});

describe('print-secret-commands - source-scan contract', () => {
  let src: string;
  beforeAll(() => {
    src = readFile('scripts/deploy/print-secret-commands.mjs');
  });

  it('source NEVER imports dotenv', () => {
    expect(src).not.toMatch(/require\(['"`]dotenv['"`]\)/);
    expect(src).not.toMatch(/from\s+['"`]dotenv['"`]/);
  });

  it('source NEVER reads .env files', () => {
    expect(src).not.toMatch(/readFile(?:Sync)?\(['"`].*\.env/);
    expect(src).not.toMatch(/createReadStream\(['"`].*\.env/);
  });

  it('source NEVER spawns gcloud', () => {
    // print-secret-commands is print-only. preflight is the spawner.
    expect(src).not.toMatch(/spawn(?:Sync)?\s*\(\s*['"`]gcloud['"`]/);
    expect(src).not.toMatch(/execFile(?:Sync)?\s*\(\s*['"`]gcloud['"`]/);
    expect(src).not.toMatch(/exec(?:Sync)?\s*\(\s*['"`]gcloud /);
  });

  it('source NEVER imports a Google Cloud SDK (no @google-cloud/secret-manager, no gcloud-node)', () => {
    expect(src).not.toMatch(/@google-cloud\/secret-manager/);
    expect(src).not.toMatch(/gcloud-node/);
  });

  it('source contains the EXPO_PUBLIC_ constraint constant', () => {
    expect(src).toContain("'EXPO_PUBLIC_'");
  });

  it('source carries the forbidden-name list (rejects xai, anthropic, resend, bearer)', () => {
    expect(src).toMatch(/anthropic/);
    expect(src).toMatch(/xai/);
    expect(src).toMatch(/resend/);
    expect(src).toMatch(/bearer/);
    expect(src).toMatch(/service-role/);
  });

  it('source never embeds a real value-shape literal (other than inside the value-shape regex array)', () => {
    // Strip the regex array block, then scan. The block is bracketed by
    // VALUE_SHAPE_PATTERNS = [ ... ];
    const trimmed = src.replace(/VALUE_SHAPE_PATTERNS[\s\S]*?];/, '');
    // Also strip the forbidden-name token array (similar pattern).
    const stripped = trimmed.replace(/FORBIDDEN_NAME_TOKENS[\s\S]*?];/, '');
    // The eyJ regex literal in the source assembled below would otherwise
    // catch itself; the strip above removes it from consideration.
    expect(stripped).not.toMatch(/\beyJ[A-Za-z0-9_.-]{10,}/);
    expect(stripped).not.toMatch(/https?:\/\/[A-Za-z0-9-]+\.supabase\.co/);
  });
});
