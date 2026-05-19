/**
 * HOST-001 — Dockerfile / .dockerignore / Cloud Run YAML / IAM YAML source-scan.
 *
 * No Docker daemon is invoked. These are plain string + regex assertions over
 * the files this card produces. The intent is to lock the doctrine surface so
 * a future contributor cannot silently:
 *   - bake EXPO_PUBLIC_SUPABASE_URL into the image
 *   - bind a forbidden secret to Cloud Run
 *   - escalate the runtime SA above secret-scoped roles
 *   - drop a service-account JSON key into the repo
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = process.cwd();

function readFile(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(REPO_ROOT, rel));
}

describe('Dockerfile — stage structure + locked build args', () => {
  let source = '';
  beforeAll(() => {
    source = readFile('Dockerfile');
  });

  it('exists at repo root', () => {
    expect(fileExists('Dockerfile')).toBe(true);
  });

  it('declares a builder stage on node:22-alpine', () => {
    expect(source).toMatch(/FROM\s+node:22-alpine\s+AS\s+builder/);
  });

  it('declares a runtime stage on the distroless nonroot Node base', () => {
    expect(source).toMatch(/FROM\s+gcr\.io\/distroless\/nodejs22-debian12:nonroot\s+AS\s+runtime/);
  });

  it('declares the locked build args (commit / version / timestamp / deploy env / app URL)', () => {
    expect(source).toMatch(/ARG\s+BUILD_COMMIT_SHA=/);
    expect(source).toMatch(/ARG\s+BUILD_VERSION=/);
    expect(source).toMatch(/ARG\s+BUILD_TIMESTAMP=/);
    expect(source).toMatch(/ARG\s+EXPO_PUBLIC_DEPLOY_ENV=/);
    expect(source).toMatch(/ARG\s+EXPO_PUBLIC_APP_URL=/);
  });

  it('runs the runtime stage as nonroot', () => {
    expect(source).toMatch(/USER\s+nonroot/);
  });

  it('exposes port 8080 (Cloud Run convention)', () => {
    expect(source).toMatch(/EXPOSE\s+8080/);
  });

  it('uses the locked CMD ["server.mjs"] entrypoint', () => {
    // The container entrypoint is the Node script that vendors `serve`.
    expect(source).toMatch(/CMD\s+\[\s*"server\.mjs"\s*\]/);
  });

  it('runs expo export to produce dist/ in the builder stage', () => {
    expect(source).toMatch(/expo\s+export\s+--platform\s+web/);
    expect(source).toMatch(/--output-dir\s+dist/);
  });

  it('bakes the dev banner EXPO_PUBLIC_* vars from build args', () => {
    expect(source).toMatch(/ENV\s+EXPO_PUBLIC_DEPLOY_ENV=\$\{EXPO_PUBLIC_DEPLOY_ENV\}/);
    expect(source).toMatch(/ENV\s+EXPO_PUBLIC_APP_URL=\$\{EXPO_PUBLIC_APP_URL\}/);
    expect(source).toMatch(/ENV\s+EXPO_PUBLIC_COMMIT_HASH=\$\{BUILD_COMMIT_SHA\}/);
    expect(source).toMatch(/ENV\s+EXPO_PUBLIC_BUILD_VERSION=\$\{BUILD_VERSION\}/);
  });

  it('declares OCI image source + revision + version labels', () => {
    expect(source).toMatch(/LABEL\s+org\.opencontainers\.image\.source=/);
    expect(source).toMatch(/LABEL\s+org\.opencontainers\.image\.revision=/);
    expect(source).toMatch(/LABEL\s+org\.opencontainers\.image\.version=/);
  });
});

describe('Dockerfile — forbidden surface', () => {
  let source = '';
  beforeAll(() => {
    source = readFile('Dockerfile');
  });

  it('does NOT contain --allow-unauthenticated as a directive (deploy flag, not image)', () => {
    // The phrase may appear in a doctrine comment line saying "no
    // --allow-unauthenticated" — that is OK. The token must not appear in any
    // ARG / ENV / CMD / RUN directive position.
    expect(source).not.toMatch(/^\s*(ARG|ENV|CMD|RUN)[^\n]*--allow-unauthenticated/m);
  });

  it('does NOT bind SUPABASE_SERVICE_ROLE_KEY as an ENV or ARG', () => {
    // The literal token may appear in a doctrine comment line (`#`) explaining
    // that this binding is forbidden. The token must NOT appear in any ARG or
    // ENV directive — those would actually bake / forward the value.
    expect(source).not.toMatch(/^\s*(ARG|ENV)\s+SUPABASE_SERVICE_ROLE_KEY/m);
    expect(source).not.toMatch(/^\s*(ARG|ENV)\s+\w*service_role/m);
  });

  it('does NOT bind ANTHROPIC_API_KEY as an ENV or ARG', () => {
    expect(source).not.toMatch(/^\s*(ARG|ENV)\s+ANTHROPIC_API_KEY/m);
  });

  it('does NOT bind XAI_API_KEY / X_BEARER_TOKEN / RESEND_API_KEY as ENV or ARG', () => {
    expect(source).not.toMatch(/^\s*(ARG|ENV)\s+XAI_API_KEY/m);
    expect(source).not.toMatch(/^\s*(ARG|ENV)\s+X_BEARER_TOKEN/m);
    expect(source).not.toMatch(/^\s*(ARG|ENV)\s+RESEND_API_KEY/m);
  });

  it('does NOT bake EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY as build args', () => {
    // These are RUNTIME bindings via --set-secrets=, never build args. If a
    // future contributor adds them as ARG, digest-only promotion breaks.
    expect(source).not.toMatch(/ARG\s+EXPO_PUBLIC_SUPABASE_URL/);
    expect(source).not.toMatch(/ARG\s+EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
    expect(source).not.toMatch(/ENV\s+EXPO_PUBLIC_SUPABASE_URL=/);
    expect(source).not.toMatch(/ENV\s+EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=/);
  });

  it('does NOT run curl / wget / apk add in the runtime stage', () => {
    // Walk lines after `FROM ... AS runtime` and assert no shell-out package
    // installers. Distroless has no shell anyway, but the lint catches
    // mistakes during local debugging where someone adds a `RUN curl` line.
    const runtimeStart = source.indexOf('AS runtime');
    expect(runtimeStart).toBeGreaterThan(-1);
    const runtimeBody = source.slice(runtimeStart);
    expect(runtimeBody).not.toMatch(/RUN\s+curl\b/);
    expect(runtimeBody).not.toMatch(/RUN\s+wget\b/);
    expect(runtimeBody).not.toMatch(/RUN\s+apk\s+add/);
    expect(runtimeBody).not.toMatch(/RUN\s+apt-get/);
  });

  it('does NOT contain a literal long-form secret shape in any LABEL', () => {
    // Assembled to avoid the source file itself looking like a leak.
    const secretShapes = [
      new RegExp('LABEL[^\\n]*sk' + '-ant-[A-Za-z0-9_-]'),
      new RegExp('LABEL[^\\n]*xai' + '-[A-Za-z0-9_-]{8,}'),
      new RegExp('LABEL[^\\n]*sb' + '_secret' + '_[A-Za-z0-9_-]'),
      new RegExp('LABEL[^\\n]*Bearer\\s+[A-Za-z0-9_-]'),
    ];
    for (const re of secretShapes) {
      expect(source).not.toMatch(re);
    }
  });
});

describe('.dockerignore — excludes the right paths', () => {
  let source = '';
  beforeAll(() => {
    source = readFile('.dockerignore');
  });

  it('exists at repo root', () => {
    expect(fileExists('.dockerignore')).toBe(true);
  });

  it('excludes node_modules, .git, .env*, logs/, .expo, __tests__, docs/', () => {
    expect(source).toMatch(/^node_modules\s*$/m);
    expect(source).toMatch(/^\.git\s*$/m);
    expect(source).toMatch(/^\.env\.?\*?\s*$/m);
    expect(source).toMatch(/^logs\s*$/m);
    expect(source).toMatch(/^\.expo\s*$/m);
    expect(source).toMatch(/^__tests__\s*$/m);
    expect(source).toMatch(/^docs\s*$/m);
  });

  it('excludes any GCP service-account JSON key patterns', () => {
    expect(source).toMatch(/gcp-key\*\.json/);
    expect(source).toMatch(/service-account\*\.json/);
  });

  it('excludes .claude/ agent worktrees and metadata', () => {
    expect(source).toMatch(/^\.claude\s*$/m);
  });
});

describe('Cloud Run service template — locked flags', () => {
  let source = '';
  const yamlPath = 'infra/cloud-run/cdiscourse-dev.template.yaml';
  beforeAll(() => {
    source = readFile(yamlPath);
  });

  it('exists', () => {
    expect(fileExists(yamlPath)).toBe(true);
  });

  it('names the service cdiscourse-dev in namespace cdiscourse-host', () => {
    expect(source).toMatch(/name:\s*cdiscourse-dev/);
    expect(source).toMatch(/namespace:\s*cdiscourse-host/);
  });

  it('sets ingress=all (IAP gates externally; not world-open)', () => {
    expect(source).toMatch(/run\.googleapis\.com\/ingress:\s*all/);
  });

  it('runs as the cdiscourse-dev-runner SA (never the Compute default)', () => {
    expect(source).toMatch(
      /serviceAccountName:\s*cdiscourse-dev-runner@cdiscourse-host\.iam\.gserviceaccount\.com/,
    );
    expect(source).not.toMatch(/compute@developer\.gserviceaccount\.com/);
  });

  it('binds only the two allowed Secret Manager secrets', () => {
    expect(source).toMatch(/name:\s*cdiscourse-dev-supabase-url/);
    expect(source).toMatch(/name:\s*cdiscourse-dev-supabase-publishable-key/);
  });

  it('does NOT bind any forbidden secret name', () => {
    expect(source).not.toMatch(/cdiscourse-dev-service-role-key/);
    expect(source).not.toMatch(/cdiscourse-dev-anthropic-api-key/);
    expect(source).not.toMatch(/cdiscourse-dev-xai-api-key/);
    expect(source).not.toMatch(/cdiscourse-dev-x-bearer-token/);
    expect(source).not.toMatch(/cdiscourse-dev-resend-api-key/);
  });

  it('caps min/max instances at 0/4 (dev blast-radius cap)', () => {
    expect(source).toMatch(/minScale:\s*"?0"?/);
    expect(source).toMatch(/maxScale:\s*"?4"?/);
  });

  it('sets memory=512Mi cpu=1 concurrency=80 timeout=60s', () => {
    expect(source).toMatch(/cpu:\s*"1"/);
    expect(source).toMatch(/memory:\s*512Mi/);
    expect(source).toMatch(/containerConcurrency:\s*80/);
    expect(source).toMatch(/timeoutSeconds:\s*60/);
  });

  it('uses gen2 execution environment', () => {
    expect(source).toMatch(/execution-environment:\s*gen2/);
  });

  it('points the container at the us-central1 cdiscourse-web Artifact Registry repo', () => {
    expect(source).toMatch(
      /us-central1-docker\.pkg\.dev\/cdiscourse-host\/cdiscourse-web\/cdiscourse-web:dev-/,
    );
  });

  it('exposes container port 8080', () => {
    expect(source).toMatch(/containerPort:\s*8080/);
  });

  it('does NOT contain --allow-unauthenticated as an annotation / spec value', () => {
    // The phrase may appear in a comment block as doctrine ("never bind X").
    // It must not appear as an actual annotation value or spec key.
    expect(source).not.toMatch(/^[^#]*allow-unauthenticated:/m);
    expect(source).not.toMatch(/--allow-unauthenticated\s*$/m);
  });
});

describe('IAM YAML templates — runtime + deployer minimum roles', () => {
  it('runtime SA template exists with the locked email + project bindings', () => {
    const p = 'infra/iam/cdiscourse-dev-runner.iam.yaml';
    expect(fileExists(p)).toBe(true);
    const src = readFile(p);
    expect(src).toMatch(/email:\s*cdiscourse-dev-runner@cdiscourse-host\.iam\.gserviceaccount\.com/);
    expect(src).toMatch(/roles\/logging\.logWriter/);
    expect(src).toMatch(/roles\/monitoring\.metricWriter/);
    expect(src).toMatch(/roles\/secretmanager\.secretAccessor/);
    expect(src).toMatch(/roles\/artifactregistry\.reader/);
  });

  it('runtime SA template forbids roles/owner + roles/editor + admin roles', () => {
    const src = readFile('infra/iam/cdiscourse-dev-runner.iam.yaml');
    // The literal listing is under forbiddenRoles; assert each appears.
    expect(src).toMatch(/forbiddenRoles:[\s\S]*roles\/owner/);
    expect(src).toMatch(/forbiddenRoles:[\s\S]*roles\/editor/);
    expect(src).toMatch(/forbiddenRoles:[\s\S]*roles\/iam\.serviceAccountKeyAdmin/);
    expect(src).toMatch(/forbiddenRoles:[\s\S]*roles\/run\.admin/);
  });

  it('runtime SA template never grants project-wide secretmanager.secretAccessor', () => {
    const src = readFile('infra/iam/cdiscourse-dev-runner.iam.yaml');
    // The secret accessor role MUST appear only under resourceBindings.
    const projectSection = src.slice(
      src.indexOf('projectBindings:'),
      src.indexOf('resourceBindings:'),
    );
    expect(projectSection).not.toMatch(/secretmanager\.secretAccessor/);
  });

  it('deployer SA template exists with the locked email + run.admin role', () => {
    const p = 'infra/iam/cdiscourse-deployer.iam.yaml';
    expect(fileExists(p)).toBe(true);
    const src = readFile(p);
    expect(src).toMatch(/email:\s*cdiscourse-deployer@cdiscourse-host\.iam\.gserviceaccount\.com/);
    expect(src).toMatch(/roles\/run\.admin/);
    expect(src).toMatch(/roles\/iam\.serviceAccountUser/);
    expect(src).toMatch(/roles\/artifactregistry\.writer/);
  });

  it('deployer SA template forbids owner + editor + secret manager access', () => {
    const src = readFile('infra/iam/cdiscourse-deployer.iam.yaml');
    expect(src).toMatch(/forbiddenRoles:[\s\S]*roles\/owner/);
    expect(src).toMatch(/forbiddenRoles:[\s\S]*roles\/editor/);
    expect(src).toMatch(/forbiddenRoles:[\s\S]*roles\/secretmanager\.secretAccessor/);
    expect(src).toMatch(/forbiddenRoles:[\s\S]*roles\/secretmanager\.admin/);
  });
});

describe('Repo-wide guard — no GCP service-account JSON keys', () => {
  // Walk the repo (excluding node_modules + worktrees) and refuse any file
  // that looks like a downloaded GCP service-account JSON key.
  function walk(dir: string, acc: string[]): string[] {
    const skip = new Set([
      'node_modules',
      '.git',
      '.claude',
      '.expo',
      'dist',
      'web-build',
      'logs',
      'artifacts',
      'coverage',
    ]);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, acc);
      else if (entry.isFile() && entry.name.endsWith('.json')) acc.push(full);
    }
    return acc;
  }

  it('no *.json file matches the GCP service-account-key shape', () => {
    const jsonFiles = walk(REPO_ROOT, []);
    // Assembled string to avoid the test source itself triggering the scan.
    const TYPE_KEY = '"type"' + ':' + ' ' + '"service_account"';
    const PRIVATE_KEY_FIELD = '"private_key"' + ':';
    for (const file of jsonFiles) {
      const contents = fs.readFileSync(file, 'utf8');
      const looksLikeKey =
        contents.includes(TYPE_KEY) && contents.includes(PRIVATE_KEY_FIELD);
      expect({ file, looksLikeKey }).toEqual({ file, looksLikeKey: false });
    }
  });
});
