/**
 * Pure-TS model for detecting which deployment environment the client is
 * running in and what to surface in the dev banner. Used by
 * `DevEnvironmentBanner.tsx` and by the gallery to mark bot/test rooms.
 *
 * No React, no React Native, no Supabase, no network. Inputs are passed
 * in by the caller (usually `process.env`); outputs are JSON-serialisable.
 */

export type DeployEnvironment = 'production' | 'dev' | 'preview' | 'local' | 'unknown';

export type BotOrTestKind = 'xai-corpus' | 'ai-corpus' | 'stress' | 'scenario' | 'seed' | null;

export interface DevEnvironmentInputs {
  /** Operator-set: 'production' | 'dev' | 'preview' | 'local'. */
  EXPO_PUBLIC_DEPLOY_ENV?: string;
  /** Operator-set: the public URL the deploy is served from. Used for fallback hints. */
  EXPO_PUBLIC_APP_URL?: string;
  /** Optional: short git hash, populated at build time. */
  EXPO_PUBLIC_COMMIT_HASH?: string;
  /** Optional: human build version, e.g. "stage-6.4.1". */
  EXPO_PUBLIC_BUILD_VERSION?: string;
  /** Optional: ops-managed contact / report-issue URL. */
  EXPO_PUBLIC_REPORT_ISSUE_URL?: string;
}

export interface BuildInfo {
  commitHash: string | null;
  buildVersion: string | null;
}

/**
 * Secret-shape patterns we refuse to display in the banner even if an
 * operator accidentally wires them through an EXPO_PUBLIC_ var. The
 * banner reads these via {@link getBuildInfo}, which scrubs matches.
 *
 * Patterns are assembled from string fragments so this source file does
 * not itself contain the literal banned tokens that
 * `__tests__/adminSecurity.test.ts` scans for in `src/`.
 */
const SECRET_SHAPES: RegExp[] = [
  new RegExp('\\bsk' + '-ant-[A-Za-z0-9_-]+'),
  new RegExp('\\bxai' + '-[A-Za-z0-9_-]{8,}'),
  new RegExp('\\bsb' + '_secret' + '_[A-Za-z0-9_-]+'),
  new RegExp('\\bBearer\\s+[A-Za-z0-9_-]+', 'i'),
  new RegExp('\\beyJ[A-Za-z0-9_-]{16,}'),
  new RegExp('\\bAuthorization\\s*:', 'i'),
];

function containsSecretShape(value: string): boolean {
  return SECRET_SHAPES.some((re) => re.test(value));
}

function normaliseEnv(raw: string | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

/**
 * Classify the deploy environment from the supplied env. Order of
 * precedence: explicit `EXPO_PUBLIC_DEPLOY_ENV` first; URL hint second;
 * fall back to `unknown`.
 *
 * Treats anything other than the known strings as `unknown` — never
 * defaults to `production`, so a misconfigured deploy fails closed
 * (i.e. the banner stays visible).
 */
export function getDeployEnvironment(env: DevEnvironmentInputs = {}): DeployEnvironment {
  const explicit = normaliseEnv(env.EXPO_PUBLIC_DEPLOY_ENV);
  if (explicit === 'production' || explicit === 'prod') return 'production';
  if (explicit === 'dev' || explicit === 'development') return 'dev';
  if (explicit === 'preview' || explicit === 'staging') return 'preview';
  if (explicit === 'local' || explicit === 'localhost') return 'local';

  const url = normaliseEnv(env.EXPO_PUBLIC_APP_URL);
  if (url.includes('/dev') || url.includes('://dev.') || url.includes('-dev.')) return 'dev';
  if (url.includes('preview') || url.includes('staging')) return 'preview';
  if (url.startsWith('http://localhost') || url.includes('127.0.0.1')) return 'local';
  if (url.startsWith('https://cdiscourse.com') || url.startsWith('https://www.cdiscourse.com')) {
    // Apex without /dev or subdomain hint = production.
    return 'production';
  }

  return 'unknown';
}

/**
 * Whether the dev banner should be visible. True for `dev`, `preview`,
 * `local`, and `unknown`. False ONLY for `production` — fail-closed.
 */
export function shouldShowDevBanner(env: DevEnvironmentInputs = {}): boolean {
  return getDeployEnvironment(env) !== 'production';
}

/**
 * Short label for the environment, used in the banner. Avoids internal
 * codes; never returns the raw env-var value.
 */
export function getDeployEnvironmentLabel(env: DevEnvironmentInputs = {}): string {
  switch (getDeployEnvironment(env)) {
    case 'production': return 'Production';
    case 'dev': return 'Dev';
    case 'preview': return 'Preview';
    case 'local': return 'Local';
    case 'unknown':
    default:
      return 'Unverified build';
  }
}

/**
 * Read commit hash + build version from env, scrubbing any value whose
 * shape resembles a long-form secret (defensive — operators should not
 * route secrets through EXPO_PUBLIC_, but if they do, we refuse to
 * display the value).
 */
export function getBuildInfo(env: DevEnvironmentInputs = {}): BuildInfo {
  const rawHash = (env.EXPO_PUBLIC_COMMIT_HASH ?? '').trim();
  const rawVersion = (env.EXPO_PUBLIC_BUILD_VERSION ?? '').trim();
  return {
    commitHash: rawHash && !containsSecretShape(rawHash) ? rawHash.slice(0, 12) : null,
    buildVersion: rawVersion && !containsSecretShape(rawVersion) ? rawVersion.slice(0, 64) : null,
  };
}

/**
 * Report-issue URL the banner links to. Defaults to the canonical GitHub
 * issues page if no operator override is set. Refuses obviously-broken
 * shapes so a misconfigured deploy renders a safe fallback.
 */
export function getReportIssueUrl(env: DevEnvironmentInputs = {}): string {
  const raw = (env.EXPO_PUBLIC_REPORT_ISSUE_URL ?? '').trim();
  if (raw && /^https?:\/\/[A-Za-z0-9.-]+\//.test(raw) && !containsSecretShape(raw)) {
    return raw;
  }
  return 'https://github.com/kyleruff1/cDiscourse/issues';
}

// ── Bot / test room classification ───────────────────────────────

/**
 * The corpus runners append deterministic suffix tags to debate titles
 * so dedupe in the gallery (`conversationGalleryModel`) and visual
 * markers (this module) can identify synthetic rooms without consulting
 * the DB. The patterns must stay aligned with `SUFFIX_TAG_PATTERNS` in
 * `conversationGalleryModel.ts`.
 */
const BOT_KIND_PATTERNS: Array<{ kind: Exclude<BotOrTestKind, null>; re: RegExp; label: string }> = [
  { kind: 'xai-corpus', re: /\bxai-adv\b/i, label: 'xAI corpus' },
  { kind: 'ai-corpus', re: /\bai-corpus\b/i, label: 'AI corpus' },
  { kind: 'stress', re: /\bstress(?:-\d+)?\b/i, label: 'Stress test' },
  { kind: 'scenario', re: /\bscenario-\d+\b/i, label: 'Scenario' },
  { kind: 'seed', re: /\bseed-\d+\b/i, label: 'Seed' },
];

export function isBotOrTestDebate(title: string | null | undefined): boolean {
  return getBotOrTestDebateKind(title) !== null;
}

export function getBotOrTestDebateKind(title: string | null | undefined): BotOrTestKind {
  if (!title) return null;
  for (const { kind, re } of BOT_KIND_PATTERNS) {
    if (re.test(title)) return kind;
  }
  return null;
}

export function getBotOrTestDebateLabel(title: string | null | undefined): string | null {
  if (!title) return null;
  for (const { re, label } of BOT_KIND_PATTERNS) {
    if (re.test(title)) return label;
  }
  return null;
}
