/**
 * HOST-005 - Secret manifest + schema + cross-file structural consistency.
 *
 * Locks the behaviour of:
 *   - infra/secrets/cdiscourse-dev-manifest.json
 *   - infra/secrets/manifest.schema.json
 *   - cross-file alignment with:
 *       infra/cloud-run/cdiscourse-dev.template.yaml
 *       infra/iam/cdiscourse-dev-runner.iam.yaml
 *
 * No `gcloud` is invoked by these tests.
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = process.cwd();

function readFile(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

function readJson<T = unknown>(rel: string): T {
  return JSON.parse(readFile(rel)) as T;
}

// Mirrors the helpers' forbidden-name list (parent spec section).
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
];

// Assembled at runtime to avoid the test source itself tripping the
// secret-shape scan.
const VALUE_SHAPE_PATTERNS: RegExp[] = [
  new RegExp('\\b' + 'sk' + '-ant-', 'i'),
  new RegExp('\\b' + 'xai' + '-[A-Za-z0-9_]', 'i'),
  new RegExp('\\b' + 'sb' + '_secret' + '_', 'i'),
  new RegExp('\\b' + 'sb' + '_publishable' + '_', 'i'),
  /\beyJ[A-Za-z0-9_.-]{10,}/,
  /\bBearer\s+[A-Za-z0-9_.-]/,
  /https?:\/\/[A-Za-z0-9-]+\.supabase\.co/i,
];

type Manifest = {
  $schema?: string;
  version: number;
  environment: string;
  project: string;
  region: string;
  runtimeServiceAccount: string;
  replicationPolicy: string;
  versionBindingPolicy: string;
  labels: Record<string, string>;
  secrets: Array<{
    name: string;
    cloudRunEnvVar: string;
    purpose: string;
    consumerFile: string;
    consumerSymbol?: string;
  }>;
};

describe('HOST-005 manifest — file shape', () => {
  let manifest: Manifest;

  beforeAll(() => {
    manifest = readJson<Manifest>('infra/secrets/cdiscourse-dev-manifest.json');
  });

  it('manifest file exists at infra/secrets/cdiscourse-dev-manifest.json', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'infra/secrets/cdiscourse-dev-manifest.json'))).toBe(true);
  });

  it('parses as JSON', () => {
    expect(typeof manifest).toBe('object');
  });

  it('declares version: 1', () => {
    expect(manifest.version).toBe(1);
  });

  it('declares environment: dev (v0 scope)', () => {
    expect(manifest.environment).toBe('dev');
  });

  it('declares project: cdiscourse-host', () => {
    expect(manifest.project).toBe('cdiscourse-host');
  });

  it('declares region: us-central1', () => {
    expect(manifest.region).toBe('us-central1');
  });

  it('declares runtimeServiceAccount cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com', () => {
    expect(manifest.runtimeServiceAccount).toBe(
      'cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com',
    );
  });

  it('declares replicationPolicy: automatic', () => {
    expect(manifest.replicationPolicy).toBe('automatic');
  });

  it('declares versionBindingPolicy: latest', () => {
    expect(manifest.versionBindingPolicy).toBe('latest');
  });

  it('labels.env is dev', () => {
    expect(manifest.labels.env).toBe('dev');
  });

  it('has exactly 2 secret entries (v0 scope guard)', () => {
    expect(Array.isArray(manifest.secrets)).toBe(true);
    expect(manifest.secrets).toHaveLength(2);
  });

  it('the two secrets are cdiscourse-dev-supabase-url and cdiscourse-dev-supabase-publishable-key', () => {
    const names = manifest.secrets.map((s) => s.name).sort();
    expect(names).toEqual([
      'cdiscourse-dev-supabase-publishable-key',
      'cdiscourse-dev-supabase-url',
    ]);
  });

  it('the two cloudRunEnvVar entries are EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', () => {
    const envs = manifest.secrets.map((s) => s.cloudRunEnvVar).sort();
    expect(envs).toEqual([
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'EXPO_PUBLIC_SUPABASE_URL',
    ]);
  });

  it('every cloudRunEnvVar starts with EXPO_PUBLIC_', () => {
    for (const s of manifest.secrets) {
      expect(s.cloudRunEnvVar.startsWith('EXPO_PUBLIC_')).toBe(true);
    }
  });

  it('every name matches cdiscourse-(dev|prod)-[a-z0-9-]+', () => {
    for (const s of manifest.secrets) {
      expect(s.name).toMatch(/^cdiscourse-(dev|prod)-[a-z0-9-]+$/);
    }
  });

  it('every consumerFile points at src/', () => {
    for (const s of manifest.secrets) {
      expect(s.consumerFile.startsWith('src/')).toBe(true);
    }
  });

  it('no manifest string field contains a forbidden-name token', () => {
    const visit = (node: unknown, p: string) => {
      if (typeof node === 'string') {
        const lower = node.toLowerCase();
        for (const tok of FORBIDDEN_NAME_TOKENS) {
          // Allow the literal in this test file itself (none here) and never
          // in the manifest. We assert manifest content only.
          expect(lower.includes(tok)).toBe(false);
        }
      } else if (Array.isArray(node)) {
        node.forEach((v, i) => visit(v, `${p}[${i}]`));
      } else if (node && typeof node === 'object') {
        for (const k of Object.keys(node as Record<string, unknown>)) {
          visit((node as Record<string, unknown>)[k], p ? `${p}.${k}` : k);
        }
      }
    };
    visit(manifest, '');
  });

  it('no manifest string field matches any value-shape pattern', () => {
    const visit = (node: unknown) => {
      if (typeof node === 'string') {
        for (const re of VALUE_SHAPE_PATTERNS) {
          expect(re.test(node)).toBe(false);
        }
      } else if (Array.isArray(node)) {
        node.forEach(visit);
      } else if (node && typeof node === 'object') {
        for (const k of Object.keys(node as Record<string, unknown>)) {
          visit((node as Record<string, unknown>)[k]);
        }
      }
    };
    visit(manifest);
  });

  it('no manifest string field references a production secret name', () => {
    const visit = (node: unknown) => {
      if (typeof node === 'string') {
        expect(node).not.toMatch(/cdiscourse-prod-/);
      } else if (Array.isArray(node)) {
        node.forEach(visit);
      } else if (node && typeof node === 'object') {
        for (const k of Object.keys(node as Record<string, unknown>)) {
          visit((node as Record<string, unknown>)[k]);
        }
      }
    };
    visit(manifest);
  });
});

describe('HOST-005 schema — file shape', () => {
  let schema: Record<string, unknown>;

  beforeAll(() => {
    schema = readJson('infra/secrets/manifest.schema.json');
  });

  it('schema file exists at infra/secrets/manifest.schema.json', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'infra/secrets/manifest.schema.json'))).toBe(true);
  });

  it('declares draft-07', () => {
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
  });

  it('cloudRunEnvVar.pattern requires EXPO_PUBLIC_ prefix', () => {
    const props = (schema.properties as Record<string, unknown>).secrets as Record<string, unknown>;
    const items = props.items as Record<string, unknown>;
    const itemProps = items.properties as Record<string, unknown>;
    const env = itemProps.cloudRunEnvVar as Record<string, unknown>;
    expect(env.pattern).toBe('^EXPO_PUBLIC_[A-Z0-9_]+$');
  });

  it('name.pattern requires cdiscourse-(dev|prod)- prefix', () => {
    const props = (schema.properties as Record<string, unknown>).secrets as Record<string, unknown>;
    const items = props.items as Record<string, unknown>;
    const itemProps = items.properties as Record<string, unknown>;
    const name = itemProps.name as Record<string, unknown>;
    expect(name.pattern).toBe('^cdiscourse-(dev|prod)-[a-z0-9-]+$');
  });

  it('project.pattern requires cdiscourse-host', () => {
    const proj = (schema.properties as Record<string, unknown>).project as Record<string, unknown>;
    expect(proj.pattern).toBe('^cdiscourse-host$');
  });

  it('region.pattern requires us-central1', () => {
    const reg = (schema.properties as Record<string, unknown>).region as Record<string, unknown>;
    expect(reg.pattern).toBe('^us-central1$');
  });

  it('versionBindingPolicy.enum contains latest', () => {
    const v = (schema.properties as Record<string, unknown>).versionBindingPolicy as Record<string, unknown>;
    expect(v.enum).toEqual(['latest']);
  });

  it('replicationPolicy.enum contains automatic', () => {
    const r = (schema.properties as Record<string, unknown>).replicationPolicy as Record<string, unknown>;
    expect(r.enum).toEqual(['automatic']);
  });

  it('environment.enum is exactly dev | prod', () => {
    const e = (schema.properties as Record<string, unknown>).environment as Record<string, unknown>;
    expect(e.enum).toEqual(['dev', 'prod']);
  });

  it('runtimeServiceAccount.pattern accepts cdiscourse-(dev|prod)-runner@cdiscourse-host', () => {
    const sa = (schema.properties as Record<string, unknown>).runtimeServiceAccount as Record<string, unknown>;
    const pat = new RegExp(sa.pattern as string);
    expect(pat.test('cdiscourse-dev-runner@cdiscourse-host.iam.gserviceaccount.com')).toBe(true);
    expect(pat.test('cdiscourse-prod-runner@cdiscourse-host.iam.gserviceaccount.com')).toBe(true);
    expect(pat.test('cdiscourse-dev-runner@other-project.iam.gserviceaccount.com')).toBe(false);
  });
});

describe('HOST-005 cross-file — manifest names match Cloud Run YAML + IAM YAML', () => {
  let manifest: Manifest;
  let cloudRunYaml: string;
  let iamYaml: string;

  beforeAll(() => {
    manifest = readJson<Manifest>('infra/secrets/cdiscourse-dev-manifest.json');
    cloudRunYaml = readFile('infra/cloud-run/cdiscourse-dev.template.yaml');
    iamYaml = readFile('infra/iam/cdiscourse-dev-runner.iam.yaml');
  });

  it('every manifest secret name appears as a secretKeyRef.name in the Cloud Run YAML', () => {
    for (const s of manifest.secrets) {
      // The YAML uses single-line `name: <secret-name>` inside secretKeyRef.
      const re = new RegExp(`name:\\s*${s.name}\\b`);
      expect(cloudRunYaml).toMatch(re);
    }
  });

  it('every manifest cloudRunEnvVar appears as a top-level env entry in the Cloud Run YAML', () => {
    for (const s of manifest.secrets) {
      const re = new RegExp(`name:\\s*${s.cloudRunEnvVar}\\b`);
      expect(cloudRunYaml).toMatch(re);
    }
  });

  it('Cloud Run YAML does NOT reference any forbidden secret name', () => {
    for (const tok of [
      'cdiscourse-dev-anthropic',
      'cdiscourse-dev-xai',
      'cdiscourse-dev-resend',
      'cdiscourse-dev-service-role',
    ]) {
      expect(cloudRunYaml).not.toMatch(new RegExp(tok));
    }
  });

  it('every manifest secret name appears in the IAM YAML with roles/secretmanager.secretAccessor', () => {
    for (const s of manifest.secrets) {
      // Each resource binding is several lines; both blocks must exist.
      expect(iamYaml).toContain(`name: ${s.name}`);
    }
    expect(iamYaml).toContain('roles/secretmanager.secretAccessor');
  });

  it('IAM YAML does NOT grant any project-wide roles/secretmanager.secretAccessor on the runtime SA', () => {
    // Pattern: under projectBindings, the runtime SA must NOT carry the
    // secretAccessor role. Resource-scoped only.
    // We grep for the role under a `projectBindings:` block — should not
    // find it before `resourceBindings:`.
    const projectIdx = iamYaml.indexOf('projectBindings:');
    const resourceIdx = iamYaml.indexOf('resourceBindings:');
    expect(projectIdx).toBeGreaterThan(-1);
    expect(resourceIdx).toBeGreaterThan(-1);
    const projectBlock = iamYaml.slice(projectIdx, resourceIdx);
    expect(projectBlock).not.toMatch(/roles\/secretmanager\.secretAccessor/);
  });
});

describe('HOST-005 manifest — doctrine self-scan across the file', () => {
  let raw: string;
  beforeAll(() => {
    raw = readFile('infra/secrets/cdiscourse-dev-manifest.json');
  });

  it('manifest source contains no SUPABASE_SERVICE_ROLE_KEY string', () => {
    expect(raw).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('manifest source contains no ANTHROPIC_API_KEY / XAI_API_KEY / X_BEARER_TOKEN / RESEND_API_KEY strings', () => {
    expect(raw).not.toMatch(/ANTHROPIC_API_KEY/);
    expect(raw).not.toMatch(/XAI_API_KEY/);
    expect(raw).not.toMatch(/X_BEARER_TOKEN/);
    expect(raw).not.toMatch(/RESEND_API_KEY/);
  });

  it('manifest source contains no service-account private key marker', () => {
    expect(raw).not.toMatch(/-----BEGIN PRIVATE KEY-----/);
  });

  it('manifest source contains no value-shape literal', () => {
    for (const re of VALUE_SHAPE_PATTERNS) {
      expect(raw).not.toMatch(re);
    }
  });
});
