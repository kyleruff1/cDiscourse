import {
  getDeployEnvironment,
  getDeployEnvironmentLabel,
  shouldShowDevBanner,
  getBuildInfo,
  getReportIssueUrl,
  isBotOrTestDebate,
  getBotOrTestDebateKind,
  getBotOrTestDebateLabel,
} from '../src/features/devEnvironment/devEnvironmentModel';

describe('getDeployEnvironment', () => {
  it('returns production for an explicit EXPO_PUBLIC_DEPLOY_ENV=production', () => {
    expect(getDeployEnvironment({ EXPO_PUBLIC_DEPLOY_ENV: 'production' })).toBe('production');
    expect(getDeployEnvironment({ EXPO_PUBLIC_DEPLOY_ENV: 'Prod' })).toBe('production');
  });

  it('returns dev for explicit dev / development', () => {
    expect(getDeployEnvironment({ EXPO_PUBLIC_DEPLOY_ENV: 'dev' })).toBe('dev');
    expect(getDeployEnvironment({ EXPO_PUBLIC_DEPLOY_ENV: 'development' })).toBe('dev');
  });

  it('returns preview for preview / staging', () => {
    expect(getDeployEnvironment({ EXPO_PUBLIC_DEPLOY_ENV: 'preview' })).toBe('preview');
    expect(getDeployEnvironment({ EXPO_PUBLIC_DEPLOY_ENV: 'STAGING' })).toBe('preview');
  });

  it('returns local for local / localhost', () => {
    expect(getDeployEnvironment({ EXPO_PUBLIC_DEPLOY_ENV: 'local' })).toBe('local');
  });

  it('falls back to URL hints when DEPLOY_ENV is missing', () => {
    expect(getDeployEnvironment({ EXPO_PUBLIC_APP_URL: 'https://cdiscourse.com/dev' })).toBe('dev');
    expect(getDeployEnvironment({ EXPO_PUBLIC_APP_URL: 'https://dev.cdiscourse.com' })).toBe('dev');
    expect(getDeployEnvironment({ EXPO_PUBLIC_APP_URL: 'https://app-staging.example' })).toBe('preview');
    expect(getDeployEnvironment({ EXPO_PUBLIC_APP_URL: 'http://localhost:8081' })).toBe('local');
  });

  it('returns production for the canonical apex URL with no /dev hint', () => {
    expect(getDeployEnvironment({ EXPO_PUBLIC_APP_URL: 'https://cdiscourse.com' })).toBe('production');
    expect(getDeployEnvironment({ EXPO_PUBLIC_APP_URL: 'https://www.cdiscourse.com' })).toBe('production');
  });

  it('returns unknown for missing and unrecognised env', () => {
    expect(getDeployEnvironment({})).toBe('unknown');
    expect(getDeployEnvironment({ EXPO_PUBLIC_DEPLOY_ENV: '    ' })).toBe('unknown');
    expect(getDeployEnvironment({ EXPO_PUBLIC_DEPLOY_ENV: 'nightly' })).toBe('unknown');
  });

  it('never silently treats unknown env as production', () => {
    // Critical: the banner must fail-closed (visible) when env is misconfigured.
    expect(getDeployEnvironment({ EXPO_PUBLIC_DEPLOY_ENV: 'whatever' })).not.toBe('production');
  });
});

describe('shouldShowDevBanner', () => {
  it('hides the banner only in production', () => {
    expect(shouldShowDevBanner({ EXPO_PUBLIC_DEPLOY_ENV: 'production' })).toBe(false);
  });

  it('shows the banner in dev / preview / local / unknown', () => {
    expect(shouldShowDevBanner({ EXPO_PUBLIC_DEPLOY_ENV: 'dev' })).toBe(true);
    expect(shouldShowDevBanner({ EXPO_PUBLIC_DEPLOY_ENV: 'preview' })).toBe(true);
    expect(shouldShowDevBanner({ EXPO_PUBLIC_DEPLOY_ENV: 'local' })).toBe(true);
    expect(shouldShowDevBanner({})).toBe(true);
    expect(shouldShowDevBanner({ EXPO_PUBLIC_DEPLOY_ENV: 'nightly' })).toBe(true);
  });
});

describe('getDeployEnvironmentLabel', () => {
  it('returns plain-language labels (no internal codes)', () => {
    expect(getDeployEnvironmentLabel({ EXPO_PUBLIC_DEPLOY_ENV: 'production' })).toBe('Production');
    expect(getDeployEnvironmentLabel({ EXPO_PUBLIC_DEPLOY_ENV: 'dev' })).toBe('Dev');
    expect(getDeployEnvironmentLabel({ EXPO_PUBLIC_DEPLOY_ENV: 'preview' })).toBe('Preview');
    expect(getDeployEnvironmentLabel({ EXPO_PUBLIC_DEPLOY_ENV: 'local' })).toBe('Local');
    expect(getDeployEnvironmentLabel({})).toBe('Unverified build');
  });

  it('never returns a raw snake_case token', () => {
    const allLabels = [
      getDeployEnvironmentLabel({ EXPO_PUBLIC_DEPLOY_ENV: 'production' }),
      getDeployEnvironmentLabel({ EXPO_PUBLIC_DEPLOY_ENV: 'dev' }),
      getDeployEnvironmentLabel({ EXPO_PUBLIC_DEPLOY_ENV: 'preview' }),
      getDeployEnvironmentLabel({ EXPO_PUBLIC_DEPLOY_ENV: 'local' }),
      getDeployEnvironmentLabel({ EXPO_PUBLIC_DEPLOY_ENV: 'unknown_foo' }),
    ];
    for (const lbl of allLabels) {
      expect(lbl).not.toMatch(/_/);
      expect(lbl).not.toMatch(/^[a-z]/); // first char is upper-case
    }
  });
});

describe('getBuildInfo', () => {
  it('returns null for missing values', () => {
    expect(getBuildInfo({})).toEqual({ commitHash: null, buildVersion: null });
  });

  it('passes through normal git hash + version', () => {
    expect(
      getBuildInfo({
        EXPO_PUBLIC_COMMIT_HASH: 'abcdef1234567890',
        EXPO_PUBLIC_BUILD_VERSION: 'stage-6.4.1',
      }),
    ).toEqual({ commitHash: 'abcdef123456', buildVersion: 'stage-6.4.1' });
  });

  it('trims whitespace', () => {
    expect(
      getBuildInfo({
        EXPO_PUBLIC_COMMIT_HASH: '  abc1234  ',
        EXPO_PUBLIC_BUILD_VERSION: '  v1.0  ',
      }),
    ).toEqual({ commitHash: 'abc1234', buildVersion: 'v1.0' });
  });

  it('refuses to surface long-form secret shapes', () => {
    // None of these should ever appear in EXPO_PUBLIC_*, but if they do
    // by operator error, the banner must NOT display them.
    const cases = [
      'sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      'xai-aaaaaaaaaaaaaaaaaaaaaaaa',
      'sb_secret_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'Bearer abcdef123456',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    ];
    for (const leak of cases) {
      const info = getBuildInfo({ EXPO_PUBLIC_COMMIT_HASH: leak, EXPO_PUBLIC_BUILD_VERSION: leak });
      expect(info.commitHash).toBeNull();
      expect(info.buildVersion).toBeNull();
    }
  });

  it('truncates over-long values defensively', () => {
    const longHash = 'a'.repeat(500);
    const longVer = 'v'.repeat(500);
    const info = getBuildInfo({ EXPO_PUBLIC_COMMIT_HASH: longHash, EXPO_PUBLIC_BUILD_VERSION: longVer });
    expect(info.commitHash?.length).toBeLessThanOrEqual(12);
    expect(info.buildVersion?.length).toBeLessThanOrEqual(64);
  });
});

describe('getReportIssueUrl', () => {
  it('defaults to the canonical GitHub issues URL', () => {
    expect(getReportIssueUrl({})).toBe('https://github.com/kyleruff1/cDiscourse/issues');
  });

  it('honours a valid operator override', () => {
    expect(getReportIssueUrl({ EXPO_PUBLIC_REPORT_ISSUE_URL: 'https://cdiscourse.com/feedback' })).toBe(
      'https://cdiscourse.com/feedback',
    );
  });

  it('refuses malformed or secret-shaped overrides and falls back to default', () => {
    const def = 'https://github.com/kyleruff1/cDiscourse/issues';
    expect(getReportIssueUrl({ EXPO_PUBLIC_REPORT_ISSUE_URL: 'ftp://foo' })).toBe(def);
    expect(getReportIssueUrl({ EXPO_PUBLIC_REPORT_ISSUE_URL: 'not a url at all' })).toBe(def);
    expect(
      getReportIssueUrl({ EXPO_PUBLIC_REPORT_ISSUE_URL: 'https://example.com/?token=sk-ant-xxxxxxxxxxxxxxxxxxxx' }),
    ).toBe(def);
  });
});

describe('isBotOrTestDebate / kind / label', () => {
  it('classifies the standard corpus suffix tags', () => {
    expect(isBotOrTestDebate('Bike lanes are better curb space [xai-adv 9018694f c45188c5]')).toBe(true);
    expect(getBotOrTestDebateKind('Bike lanes are better curb space [xai-adv 9018694f c45188c5]')).toBe('xai-corpus');
    expect(getBotOrTestDebateLabel('Bike lanes are better curb space [xai-adv 9018694f c45188c5]')).toBe('xAI corpus');

    expect(getBotOrTestDebateKind('Pitch clock changed baseball pacing [ai-corpus fa172432 ai-seed-pitch-clock]')).toBe(
      'ai-corpus',
    );
    expect(getBotOrTestDebateLabel('Pitch clock changed baseball pacing [ai-corpus fa172432 ai-seed-pitch-clock]')).toBe(
      'AI corpus',
    );

    expect(getBotOrTestDebateKind('Sports debate [stress-2026-05-17 #scenario-7]')).toBe('stress');
    expect(getBotOrTestDebateLabel('Sports debate [stress-2026-05-17 #scenario-7]')).toBe('Stress test');
  });

  it('returns null for normal user titles', () => {
    expect(isBotOrTestDebate('Should remote work be the default?')).toBe(false);
    expect(getBotOrTestDebateKind('Should remote work be the default?')).toBeNull();
    expect(getBotOrTestDebateLabel('Should remote work be the default?')).toBeNull();
  });

  it('handles null / empty / undefined titles defensively', () => {
    expect(isBotOrTestDebate(null)).toBe(false);
    expect(isBotOrTestDebate(undefined)).toBe(false);
    expect(isBotOrTestDebate('')).toBe(false);
    expect(getBotOrTestDebateLabel(null)).toBeNull();
  });

  it('matches the scenario / seed marker patterns', () => {
    expect(getBotOrTestDebateKind('Climate debate (scenario-42 mode)')).toBe('scenario');
    expect(getBotOrTestDebateLabel('Climate debate (scenario-42 mode)')).toBe('Scenario');
    expect(getBotOrTestDebateKind('Climate debate (seed-9 mode)')).toBe('seed');
  });

  it('label vocabulary uses plain language only — no verdict tokens, no snake_case', () => {
    const allLabels = [
      getBotOrTestDebateLabel('foo [xai-adv x]'),
      getBotOrTestDebateLabel('foo [ai-corpus x]'),
      getBotOrTestDebateLabel('foo [stress-2026 #x]'),
      getBotOrTestDebateLabel('foo (scenario-1 mode)'),
      getBotOrTestDebateLabel('foo (seed-1 mode)'),
    ];
    const forbidden = /troll|bot label|liar|propagandist|extremist|bad faith|winner|loser|stupid|idiot/i;
    for (const lbl of allLabels) {
      expect(lbl).not.toBeNull();
      expect(lbl).not.toMatch(forbidden);
      expect(lbl).not.toMatch(/_/);
    }
  });
});
