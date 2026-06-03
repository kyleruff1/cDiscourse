/**
 * CORPUS-30-POOL-DRIVEN-PLANNER §10: live-mode gate enforcement.
 *
 * Live mode requires ALL of: --pilot + ENGAGEMENT_INTEL_ENABLE_ANTHROPIC=true
 * + ANTHROPIC_API_KEY + .env.bot-tests present. Anything missing → refuse.
 */
const runner = require('../scripts/bot-fixtures/runXaiAdversarialBotCorpus');

describe('CORPUS-30 live-mode gate', () => {
  it('refuses live when --pilot is missing', () => {
    const reasons = runner.refuseLive(
      { pilot: false },
      { hasXaiKey: true, enableXai: true, hasAnthropicKey: true, enableAnthropic: true, hasBotTests: true },
    );
    expect(reasons).toContain('--pilot not set');
  });

  it('refuses live when ANTHROPIC_API_KEY is missing', () => {
    const reasons = runner.refuseLive(
      { pilot: true },
      { hasXaiKey: true, enableXai: true, hasAnthropicKey: false, enableAnthropic: true, hasBotTests: true },
    );
    expect(reasons).toContain('ANTHROPIC_API_KEY missing');
  });

  it('refuses live when ENGAGEMENT_INTEL_ENABLE_ANTHROPIC is not true', () => {
    const reasons = runner.refuseLive(
      { pilot: true },
      { hasXaiKey: true, enableXai: true, hasAnthropicKey: true, enableAnthropic: false, hasBotTests: true },
    );
    expect(reasons).toContain('ENGAGEMENT_INTEL_ENABLE_ANTHROPIC not true');
  });

  it('refuses live when .env.bot-tests is missing', () => {
    const reasons = runner.refuseLive(
      { pilot: true },
      { hasXaiKey: true, enableXai: true, hasAnthropicKey: true, enableAnthropic: true, hasBotTests: false },
    );
    expect(reasons).toContain('.env.bot-tests missing');
  });

  it('refuses live when XAI_API_KEY is missing', () => {
    const reasons = runner.refuseLive(
      { pilot: true },
      { hasXaiKey: false, enableXai: true, hasAnthropicKey: true, enableAnthropic: true, hasBotTests: true },
    );
    expect(reasons).toContain('XAI_API_KEY missing');
  });

  it('allows live when ALL gates are satisfied', () => {
    const reasons = runner.refuseLive(
      { pilot: true },
      { hasXaiKey: true, enableXai: true, hasAnthropicKey: true, enableAnthropic: true, hasBotTests: true },
    );
    expect(reasons).toEqual([]);
  });
});
