/**
 * HOST-005 - scripts/deploy/preflight-secrets.{mjs,ps1,sh} contract.
 *
 * Asserts:
 *   - Wrapper files exist.
 *   - Exit codes against the test stub (which simulates `gcloud secrets ...`
 *     responses driven by HOST_005_STUB_* env vars).
 *   - The source NEVER calls `gcloud secrets versions access` (which would
 *     read a value) and never reads .env*.
 *   - Only the documented gcloud subcommands appear in the source.
 *   - --strict-project flag is honored.
 *   - --json output schema includes only name + exists + enabledVersions +
 *     hasRuntimeBinding (no value field).
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

const REPO_ROOT = process.cwd();
const ENTRYPOINT = path.join(REPO_ROOT, 'scripts/deploy/preflight-secrets.mjs');
const STUB = path.join(REPO_ROOT, '__tests__/fixtures/host-005-gcloud-stub.mjs');
const MANIFEST = 'infra/secrets/cdiscourse-dev-manifest.json';

function readFile(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}
function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(REPO_ROOT, rel));
}

function run(args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [ENTRYPOINT, ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env } as NodeJS.ProcessEnv,
    encoding: 'utf8',
  });
}

const STUB_FLAG = `--gcloud-bin=${STUB}`;

describe('preflight-secrets - file existence', () => {
  it('mjs + ps1 + sh wrappers all exist', () => {
    expect(fileExists('scripts/deploy/preflight-secrets.mjs')).toBe(true);
    expect(fileExists('scripts/deploy/preflight-secrets.ps1')).toBe(true);
    expect(fileExists('scripts/deploy/preflight-secrets.sh')).toBe(true);
  });

  it('ps1 wrapper forwards to the .mjs', () => {
    const src = readFile('scripts/deploy/preflight-secrets.ps1');
    expect(src).toMatch(/preflight-secrets\.mjs/);
    expect(src).toMatch(/node\s+\$Entrypoint/);
  });

  it('sh wrapper forwards to the .mjs', () => {
    const src = readFile('scripts/deploy/preflight-secrets.sh');
    expect(src).toMatch(/preflight-secrets\.mjs/);
    expect(src).toMatch(/exec node/);
  });
});

describe('preflight-secrets - exit codes against the test stub', () => {
  it('exit 0 when both secrets exist with ENABLED versions and IAM bindings', () => {
    const r = run([`--manifest=${MANIFEST}`, STUB_FLAG, '--strict-project']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/exists=true/);
    expect(r.stdout).toMatch(/enabledVersions=1/);
    expect(r.stdout).toMatch(/hasRuntimeBinding=true/);
  });

  it('exit 5 when at least one secret has no ENABLED version', () => {
    const r = run([`--manifest=${MANIFEST}`, STUB_FLAG, '--strict-project'], {
      HOST_005_STUB_NO_ENABLED: 'cdiscourse-dev-supabase-url',
    });
    expect(r.status).toBe(5);
  });

  it('exit 5 when at least one secret has no runtime IAM binding', () => {
    const r = run([`--manifest=${MANIFEST}`, STUB_FLAG, '--strict-project'], {
      HOST_005_STUB_NO_IAM: 'cdiscourse-dev-supabase-url',
    });
    expect(r.status).toBe(5);
  });

  it('exit 6 when a secret does not exist', () => {
    const r = run([`--manifest=${MANIFEST}`, STUB_FLAG, '--strict-project'], {
      HOST_005_STUB_MISSING: 'cdiscourse-dev-supabase-url',
    });
    expect(r.status).toBe(6);
  });

  it('exit 4 when gcloud project mismatches manifest project and --strict-project is set', () => {
    const r = run([`--manifest=${MANIFEST}`, STUB_FLAG, '--strict-project'], {
      HOST_005_STUB_PROJECT: 'not-cdiscourse',
    });
    expect(r.status).toBe(4);
    expect(r.stderr).toMatch(/not-cdiscourse/);
  });

  it('exit 0 (with stderr warning) when project mismatches but --strict-project is NOT set', () => {
    const r = run([`--manifest=${MANIFEST}`, STUB_FLAG], {
      HOST_005_STUB_PROJECT: 'not-cdiscourse',
    });
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/warning/);
  });

  it('exit 0 with stderr-warning when --no-strict-project is passed and project mismatches', () => {
    const r = run([`--manifest=${MANIFEST}`, STUB_FLAG, '--no-strict-project'], {
      HOST_005_STUB_PROJECT: 'not-cdiscourse',
    });
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/warning/);
    expect(r.stderr).toMatch(/--no-strict-project/);
  });

  it('exit 3 when gcloud binary is missing', () => {
    const r = run([
      `--manifest=${MANIFEST}`,
      '--gcloud-bin=nonexistent-binary-host-005',
      '--strict-project',
    ]);
    expect(r.status).toBe(3);
    expect(r.stderr).toMatch(/gcloud not on PATH/);
  });

  it('exit 5 when --manifest is missing', () => {
    const r = run([STUB_FLAG]);
    expect(r.status).toBe(5);
    expect(r.stderr).toMatch(/--manifest/);
  });

  it('exit 2 when manifest does not exist', () => {
    const r = run([`--manifest=does/not/exist.json`, STUB_FLAG]);
    expect(r.status).toBe(2);
  });
});

describe('preflight-secrets - --json output schema', () => {
  it('emits structured JSON with the documented fields and NO value field', () => {
    const r = run([`--manifest=${MANIFEST}`, STUB_FLAG, '--strict-project', '--json']);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as {
      manifest: string;
      project: string;
      checked: Array<Record<string, unknown>>;
      summary: { ok: boolean; missing: number; noEnabledVersion: number; noRuntimeBinding: number };
    };
    expect(parsed.manifest).toBe(MANIFEST);
    expect(parsed.project).toBe('cdiscourse-host');
    expect(parsed.checked).toHaveLength(2);
    for (const entry of parsed.checked) {
      // Only the four documented fields. NEVER a value or version content.
      expect(Object.keys(entry).sort()).toEqual(
        ['enabledVersions', 'exists', 'hasRuntimeBinding', 'name'],
      );
      expect(entry).not.toHaveProperty('value');
      expect(entry).not.toHaveProperty('payload');
    }
    expect(parsed.summary.ok).toBe(true);
  });
});

describe('preflight-secrets - source-scan contract', () => {
  let src: string;
  beforeAll(() => {
    src = readFile('scripts/deploy/preflight-secrets.mjs');
  });

  it('source NEVER calls `gcloud secrets versions access`', () => {
    // This is the doctrine guard. Reading a value is the one thing preflight
    // must never do.
    //
    // We strip comment lines + help-text array entries first so doctrine
    // self-reference is permitted (`// NEVER calls "gcloud secrets versions
    // access"`) while a real call pattern is rejected.
    const stripped = src
      // Strip // line comments.
      .split(/\r?\n/)
      .filter((line) => !/^\s*\/\//.test(line))
      .join('\n')
      // Strip help-text array entries: anything wrapped in single quotes
      // beginning with "Doctrine:" or "      '...gcloud..." help bullets.
      .replace(/'[^']*never calls[^']*'/gi, "''")
      .replace(/'[^']*versions access[^']*'/gi, "''");
    // The forbidden subcommand-as-argv pattern must not appear anywhere.
    expect(stripped).not.toMatch(/['"`]versions['"`]\s*,\s*['"`]access['"`]/);
    // And no `gcloud secrets versions access` as a function-call literal.
    expect(stripped).not.toMatch(/spawn(?:Sync)?\s*\([^)]*?versions[^)]*?access/);
  });

  it('source only references the documented gcloud subcommands', () => {
    // Collect every literal "gcloud" verb appearing in the source. We look
    // for the array-arg form e.g. `'secrets', 'describe'` and the string
    // form e.g. `gcloud secrets describe`.
    // Documented list: --version, config get-value project, secrets describe,
    // secrets versions list, secrets get-iam-policy.
    const allowedVerbs = [
      /['"`]--version['"`]/,
      /['"`]config['"`]\s*,\s*['"`]get-value['"`]\s*,\s*['"`]project['"`]/,
      /['"`]secrets['"`]\s*,\s*['"`]describe['"`]/,
      /['"`]secrets['"`]\s*,\s*['"`]versions['"`]\s*,\s*['"`]list['"`]/,
      /['"`]secrets['"`]\s*,\s*['"`]get-iam-policy['"`]/,
    ];
    for (const re of allowedVerbs) {
      expect(src).toMatch(re);
    }
    // Forbidden:
    expect(src).not.toMatch(/['"`]secrets['"`]\s*,\s*['"`]create['"`]/);
    expect(src).not.toMatch(/['"`]secrets['"`]\s*,\s*['"`]delete['"`]/);
    expect(src).not.toMatch(/['"`]secrets['"`]\s*,\s*['"`]add-iam-policy-binding['"`]/);
    expect(src).not.toMatch(/['"`]secrets['"`]\s*,\s*['"`]remove-iam-policy-binding['"`]/);
    expect(src).not.toMatch(/['"`]versions['"`]\s*,\s*['"`]add['"`]/);
    expect(src).not.toMatch(/['"`]versions['"`]\s*,\s*['"`]disable['"`]/);
    expect(src).not.toMatch(/['"`]versions['"`]\s*,\s*['"`]destroy['"`]/);
    expect(src).not.toMatch(/['"`]versions['"`]\s*,\s*['"`]access['"`]/);
  });

  it('source NEVER imports dotenv', () => {
    expect(src).not.toMatch(/require\(['"`]dotenv['"`]\)/);
    expect(src).not.toMatch(/from\s+['"`]dotenv['"`]/);
  });

  it('source NEVER reads .env files', () => {
    expect(src).not.toMatch(/readFile(?:Sync)?\(['"`].*\.env/);
    expect(src).not.toMatch(/createReadStream\(['"`].*\.env/);
  });

  it('source NEVER imports a Google Cloud SDK', () => {
    expect(src).not.toMatch(/@google-cloud\/secret-manager/);
    expect(src).not.toMatch(/gcloud-node/);
  });

  it('source carries the EXPO_PUBLIC_ constraint constant', () => {
    expect(src).toContain("'EXPO_PUBLIC_'");
  });

  it('source carries the forbidden-name list (anthropic, xai, bearer, resend, service-role)', () => {
    expect(src).toMatch(/anthropic/);
    expect(src).toMatch(/xai/);
    expect(src).toMatch(/bearer/);
    expect(src).toMatch(/resend/);
    expect(src).toMatch(/service-role/);
  });
});

describe('preflight-secrets - runbook structure (host-005-secrets-runbook.md)', () => {
  let runbook: string;
  beforeAll(() => {
    runbook = readFile('docs/deployment/host-005-secrets-runbook.md');
  });

  it('runbook file exists', () => {
    expect(fileExists('docs/deployment/host-005-secrets-runbook.md')).toBe(true);
  });

  it('contains exactly 9 numbered top-level steps as ATX H3 + bold title', () => {
    const stepHeaders = runbook.match(/^#+\s*[1-9]\.\s+\*\*/gm) || [];
    expect(stepHeaders).toHaveLength(9);
  });

  it('every step section asserts "The agent does NOT run"', () => {
    // Should appear at least 9 times -- once per step.
    const occurrences = runbook.match(/agent does NOT run/g) || [];
    expect(occurrences.length).toBeGreaterThanOrEqual(9);
  });

  it('contains Clear-History (PowerShell) and history -c (bash) guidance', () => {
    expect(runbook).toContain('Clear-History');
    expect(runbook).toContain('history -c');
  });

  it('references docs/deployment/host-001-operator-runbook.md', () => {
    expect(runbook).toMatch(/host-001-operator-runbook\.md/);
  });

  it('references both helper scripts by name', () => {
    expect(runbook).toContain('print-secret-commands.mjs');
    expect(runbook).toContain('preflight-secrets.mjs');
  });

  it('never references any forbidden secret name (service-role / anthropic / xai / bearer / resend)', () => {
    // Forbidden refs as actual subjects of binding. The runbook does
    // explicitly say "stays in Supabase Function secrets, never bound to Cloud
    // Run" for these names -- that's the doctrine assertion, not a binding,
    // so we allow the literals to appear once each in that explicit
    // exclusion list. The forbidden pattern here is the *presence in a
    // command*, not the presence anywhere.
    expect(runbook).not.toMatch(/gcloud secrets (?:create|add-iam-policy-binding|versions add)[^\n]*?SUPABASE_SERVICE_ROLE_KEY/i);
    expect(runbook).not.toMatch(/gcloud secrets (?:create|add-iam-policy-binding|versions add)[^\n]*?ANTHROPIC_API_KEY/i);
    expect(runbook).not.toMatch(/gcloud secrets (?:create|add-iam-policy-binding|versions add)[^\n]*?XAI_API_KEY/i);
    expect(runbook).not.toMatch(/gcloud secrets (?:create|add-iam-policy-binding|versions add)[^\n]*?X_BEARER_TOKEN/i);
    expect(runbook).not.toMatch(/gcloud secrets (?:create|add-iam-policy-binding|versions add)[^\n]*?RESEND_API_KEY/i);
  });

  it('contains no value-shape literal', () => {
    expect(runbook).not.toMatch(new RegExp('\\b' + 'sk' + '-ant-', 'i'));
    expect(runbook).not.toMatch(new RegExp('\\b' + 'xai' + '-[A-Za-z0-9_]', 'i'));
    expect(runbook).not.toMatch(new RegExp('\\b' + 'sb' + '_secret' + '_', 'i'));
    expect(runbook).not.toMatch(/\beyJ[A-Za-z0-9_.-]{10,}/);
    expect(runbook).not.toMatch(/https?:\/\/[A-Za-z0-9-]+\.supabase\.co/);
  });

  it('references the locked project + region', () => {
    expect(runbook).toContain('cdiscourse-host');
    expect(runbook).toContain('us-central1');
  });
});

describe('HOST-001 runbook step 13 - HOST-005 patch landed', () => {
  let runbook: string;
  beforeAll(() => {
    runbook = readFile('docs/deployment/host-001-operator-runbook.md');
  });

  it('step 13 references the HOST-005 runbook by path', () => {
    expect(runbook).toMatch(/host-005-secrets-runbook\.md/);
  });

  it('step 13 references the print-secret-commands helper', () => {
    expect(runbook).toMatch(/print-secret-commands/);
  });

  it('step 13 references the preflight-secrets helper', () => {
    expect(runbook).toMatch(/preflight-secrets/);
  });
});
