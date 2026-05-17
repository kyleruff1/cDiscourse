/**
 * xAI auth probe — fail-closed contract tests.
 *
 * No HTTP. We assert:
 *   - Dry run makes zero network calls.
 *   - With XAI_API_KEY missing AND no `--probe-missing-key`, the live probe
 *     refuses.
 *   - The sanitizer scrubs xAI keys, Bearer tokens, generic sk- keys, JWT-
 *     shape tokens, Supabase secret tokens, Anthropic-shape keys, and
 *     Authorization header lines.
 *   - The env snapshot never leaks raw values.
 *   - The existing xaiClassifyPairs CLI is still disabled by default.
 *   - The probe targets a documented xAI host on the official api.x.ai base.
 */
import * as path from 'path';
import * as fs from 'fs';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const probe = require(path.join(repoRoot, 'scripts/engagement-intelligence/xaiAuthProbe.js'));
const xaiCli = require(path.join(repoRoot, 'scripts/engagement-intelligence/xaiClassifyPairs.js'));

// ── pure helpers ───────────────────────────────────────────────

describe('xaiAuthProbe — argument parsing', () => {
  it('defaults to dry (no --probe-live)', () => {
    expect(probe.parseArgs(['node', 'x'])).toEqual({ probeLive: false, probeMissingKey: false });
  });
  it('flips probeLive on --probe-live', () => {
    expect(probe.parseArgs(['node', 'x', '--probe-live'])).toMatchObject({ probeLive: true });
  });
  it('requires both flags to opt into missing-key probe', () => {
    const args = probe.parseArgs(['node', 'x', '--probe-live', '--probe-missing-key']);
    expect(args.probeLive).toBe(true);
    expect(args.probeMissingKey).toBe(true);
  });
});

describe('xaiAuthProbe — sanitize()', () => {
  it('redacts xai-... keys', () => {
    expect(probe.sanitize('failed with key xai-abcDEF_123456789')).not.toContain('xai-abcDEF_123456789');
    expect(probe.sanitize('failed with key xai-abcDEF_123456789')).toContain('[redacted]');
  });
  it('redacts Authorization headers', () => {
    expect(probe.sanitize('Authorization: Bearer foobarbaz12345')).not.toContain('foobarbaz12345');
  });
  it('redacts JWT-shape tokens', () => {
    expect(probe.sanitize('payload eyJabcdefghij.eyJxyzdef')).toContain('[redacted]');
  });
  it('redacts Supabase + Anthropic shape tokens', () => {
    expect(probe.sanitize('mix ' + ['sb', 'secret'].join('_') + '_AAA111 ' + ['sk', 'ant'].join('-') + '-BBB222')).not.toContain('AAA111');
  });
});

describe('xaiAuthProbe — safeEnvSnapshot()', () => {
  beforeEach(() => {
    delete process.env.XAI_API_KEY;
    delete process.env.XAI_MODEL;
    delete process.env.ENGAGEMENT_INTEL_ENABLE_XAI;
  });

  it('returns booleans only — no raw values', () => {
    process.env.XAI_API_KEY = 'xai-actual-secret-value';
    process.env.ENGAGEMENT_INTEL_ENABLE_XAI = 'true';
    const snap = probe.safeEnvSnapshot();
    const serialized = JSON.stringify(snap);
    expect(serialized).not.toContain('xai-actual-secret-value');
    expect(snap.hasXaiKey).toBe(true);
    expect(snap.enableXai).toBe(true);
  });

  it('rejects model name that looks like a key', () => {
    process.env.XAI_MODEL = 'xai-grok-suspicious';
    const snap = probe.safeEnvSnapshot();
    expect(snap.modelName).toBe('<rejected:not-a-model-name>');
  });

  it('passes a normal model name through', () => {
    process.env.XAI_MODEL = 'grok-4-latest';
    const snap = probe.safeEnvSnapshot();
    expect(snap.modelName).toBe('grok-4-latest');
  });
});

describe('xaiAuthProbe — endpoint constants', () => {
  it('uses official xAI base host', () => {
    expect(probe.XAI_BASE).toBe('https://api.x.ai');
  });
  it('targets a read-only listing endpoint', () => {
    expect(probe.AUTH_PATH).toBe('/v1/models');
  });
});

// ── dry-mode spawn: no network ─────────────────────────────────

describe('xaiAuthProbe — dry mode makes no network call', () => {
  // We run the script via spawn (with no flags) and assert it exits 0 and
  // does not print anything that smells like a token.
  it('dry run exits 0 and prints "dry auth probe only; no network"', () => {
    const res = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/engagement-intelligence/xaiAuthProbe.js')], {
      cwd: repoRoot,
      env: { ...process.env, XAI_API_KEY: '', ENGAGEMENT_INTEL_ENABLE_XAI: 'false' },
      encoding: 'utf8',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('mode=dry');
    expect(res.stdout).toContain('dry auth probe only; no network');
    // No key fragments / headers / Bearer text.
    expect(res.stdout).not.toMatch(/Bearer\s+[A-Za-z0-9]/);
    expect(res.stdout).not.toMatch(/xai-[A-Za-z0-9_]{8,}/);
    expect(res.stdout).not.toMatch(/Authorization\s*:\s*\S+/i);
  });

  it('live probe with NO key and NO --probe-missing-key refuses without network', () => {
    const res = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/engagement-intelligence/xaiAuthProbe.js'), '--probe-live'], {
      cwd: repoRoot,
      env: { ...process.env, XAI_API_KEY: '', ENGAGEMENT_INTEL_ENABLE_XAI: 'false' },
      encoding: 'utf8',
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('refusing: XAI_API_KEY is missing');
    expect(res.stdout).toContain('no_key_no_explicit_flag');
    expect(res.stdout).not.toMatch(/Bearer\s+[A-Za-z0-9]/);
    expect(res.stdout).not.toMatch(/xai-[A-Za-z0-9_]{8,}/);
  });
});

// ── Windows clean-exit fix: body cancel + event-loop drain ─────

describe('xaiAuthProbe — releaseResponseBody', () => {
  it('calls res.body.cancel() when available', async () => {
    const cancel = jest.fn(async () => undefined);
    const fakeRes = { body: { cancel } } as { body: { cancel: jest.Mock } };
    await probe.releaseResponseBody(fakeRes);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('swallows cancel errors and never throws', async () => {
    const cancel = jest.fn(async () => { throw new Error('xai-shouldneverleak boom'); });
    const fakeRes = { body: { cancel }, arrayBuffer: jest.fn(async () => undefined) };
    await expect(probe.releaseResponseBody(fakeRes)).resolves.toBeUndefined();
    expect(cancel).toHaveBeenCalled();
  });

  it('is a no-op for a response with no body', async () => {
    await expect(probe.releaseResponseBody({ body: null })).resolves.toBeUndefined();
    await expect(probe.releaseResponseBody(null)).resolves.toBeUndefined();
  });

  it('falls back to arrayBuffer drain when cancel is not available', async () => {
    const arrayBuffer = jest.fn(async () => new ArrayBuffer(0));
    const fakeRes = { body: { /* no cancel */ }, arrayBuffer };
    await probe.releaseResponseBody(fakeRes);
    expect(arrayBuffer).toHaveBeenCalled();
  });
});

describe('xaiAuthProbe — drainEventLoop', () => {
  it('resolves after at least one event-loop tick', async () => {
    const start = Date.now();
    await probe.drainEventLoop();
    // setImmediate + setTimeout(0) — should be near-instant on any platform.
    expect(Date.now() - start).toBeLessThan(200);
  });
});

describe('xaiAuthProbe — main entry no longer hard-exits', () => {
  it('source uses process.exitCode and avoids process.exit() in the live entry', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'scripts/engagement-intelligence/xaiAuthProbe.js'), 'utf8');
    // process.exitCode is the correct Windows-friendly approach.
    expect(src).toMatch(/process\.exitCode\s*=/);
    // The require.main entry block must not call process.exit() as actual
    // code (comments documenting why we avoid it are fine).
    const mainBlock = src.slice(src.indexOf('if (require.main === module)'));
    const codeOnly = mainBlock
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
      .join('\n');
    expect(codeOnly).not.toMatch(/process\.exit\(/);
  });

  it('source calls drainEventLoop after a live probe', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'scripts/engagement-intelligence/xaiAuthProbe.js'), 'utf8');
    expect(src).toMatch(/await drainEventLoop\(\)/);
  });

  it('source releases the response body before mapping the category', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'scripts/engagement-intelligence/xaiAuthProbe.js'), 'utf8');
    const probeIdx = src.indexOf('async function probeAuth');
    const releaseIdx = src.indexOf('releaseResponseBody', probeIdx);
    const categoryIdx = src.indexOf('category =', probeIdx);
    expect(releaseIdx).toBeGreaterThan(probeIdx);
    expect(releaseIdx).toBeLessThan(categoryIdx);
  });
});

// ── xaiClassifyPairs: still disabled ──────────────────────────

describe('xaiClassifyPairs CLI — production scaffold remains deterministic-first', () => {
  it('parseArgs defaults pilot=false', () => {
    expect(xaiCli.parseArgs(['node', 'x'])).toEqual({ pilot: false });
  });

  it('disabled() returns a refusal object with no secret content', () => {
    const out = xaiCli.disabled('env_flag_off');
    expect(out.enabled).toBe(false);
    expect(out.disabledReason).toBe('env_flag_off');
    expect(out.output).toBeNull();
    expect(JSON.stringify(out)).not.toMatch(/xai-[A-Za-z0-9]/);
  });
});

// ── log redaction integration ─────────────────────────────────

describe('no probe output contains key/token/header strings', () => {
  it('snapshot output never includes raw key', () => {
    process.env.XAI_API_KEY = 'xai-shouldneverleak-1234';
    try {
      const snap = probe.safeEnvSnapshot();
      const json = JSON.stringify(snap);
      expect(json).not.toContain('xai-shouldneverleak-1234');
    } finally {
      delete process.env.XAI_API_KEY;
    }
  });

  it('xaiAuthProbe source file does not log raw Authorization header', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'scripts/engagement-intelligence/xaiAuthProbe.js'), 'utf8');
    // The string "Authorization" appears only when SETTING the header, never
    // when CONSOLE-LOGGING. We allow lines that mention it but enforce that
    // nothing matches /console\.log.*Authorization/.
    expect(src).not.toMatch(/console\.(log|error|warn)\([^)]*Authorization[^)]*\$\{/);
  });
});
