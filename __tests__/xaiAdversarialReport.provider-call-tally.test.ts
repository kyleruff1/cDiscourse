/**
 * CORPUS-30-LIVE-PATH-WIRING — Fix 3, Test 6.
 *
 * Asserts the Markdown summary's "Run counts" section reports REAL
 * integers when the JSONL contains provider_call_summary or per-event
 * signals. The literal "(not wired in this commit)" disclaimer is gone.
 *
 * Per design §4 Fix 3 + ratified default §9 #3 (both): the runner emits
 * a `provider_call_summary` event before `run_summary`; the reporter
 * prefers it but ALSO aggregates from per-event signals when absent.
 */

const reportLib = require('../scripts/bot-fixtures/xaiAdversarialReport');
const corpusReportLib = require('../scripts/engagement-intelligence/xaiAdversarialCorpusReport');
const runner = require('../scripts/bot-fixtures/runXaiAdversarialBotCorpus');

type Event = Record<string, unknown>;

describe('CORPUS-30 provider-call tally — real counts in Markdown', () => {
  it('runner.computeProviderCallTally prefers provider_call_summary event when present', () => {
    const events: Event[] = [
      { stage: 'submit_result', status: 'posted', moveId: 'm1' },
      { stage: 'submit_result', status: 'posted', moveId: 'm2' },
      { stage: 'move_rendered', source: 'anthropic', moveId: 'm3' },
      { stage: 'provider_query' },
      { stage: 'provider_call_summary', runId: 'r1', xaiCalls: 7, anthropicCalls: 12, supabaseWrites: 27 },
    ];
    const tally = runner.computeProviderCallTally(events);
    expect(tally.source).toBe('provider_call_summary');
    expect(tally.xaiCalls).toBe(7);
    expect(tally.anthropicCalls).toBe(12);
    expect(tally.supabaseWrites).toBe(27);
  });

  it('runner.computeProviderCallTally falls back to aggregation when no summary present', () => {
    const events: Event[] = [
      { stage: 'submit_result', status: 'posted', moveId: 'm1' },
      { stage: 'submit_result', status: 'posted', moveId: 'm2' },
      { stage: 'move_rendered', source: 'anthropic' },
      { stage: 'move_rendered', source: 'anthropic' },
      { stage: 'move_rendered', source: 'deterministic_fallback' },
      { stage: 'provider_query' },
    ];
    const tally = runner.computeProviderCallTally(events);
    expect(tally.source).toBe('aggregated_from_events');
    expect(tally.anthropicCalls).toBe(2); // only source==='anthropic'
    expect(tally.supabaseWrites).toBe(2); // 2 posted
    expect(tally.xaiCalls).toBe(1);       // 1 provider_query
  });

  it('xaiAdversarialReport.buildAdversarialReportMarkdown reports real integers, NO "(not wired)" disclaimer', () => {
    const events: Event[] = [
      { stage: 'provider_call_summary', runId: 'r', xaiCalls: 5, anthropicCalls: 9, supabaseWrites: 27 },
    ];
    const md = reportLib.buildAdversarialReportMarkdown({
      runId: 'r', dateIso: '2026-06-03T12:00:00Z',
      mode: 'live', providerLabel: 'xai_responses',
      args: { rooms: 3, candidatePosts: 5, topReplies: 12, maxDepth: 6, sourceMode: 'xai_live', allowSyntheticRebuttal: true, syntheticRebuttalThreshold: 0, seed: 's', envBooleans: {} },
      events,
      sceneSummaries: [],
      samples: {},
    });
    expect(md).toContain('xAI calls: 5');
    expect(md).toContain('Anthropic calls: 9');
    expect(md).toContain('Supabase writes: 27');
    expect(md).not.toContain('not wired');
    expect(md).not.toContain('(not wired in this commit)');
  });

  it('runXaiAdversarialBotCorpus.buildMarkdownReport reports real integers from provider_call_summary', () => {
    const events: Event[] = [
      { stage: 'provider_call_summary', runId: 'r', xaiCalls: 4, anthropicCalls: 8, supabaseWrites: 30 },
    ];
    const md = runner.buildMarkdownReport({
      runId: 'r',
      args: { dry: false, scenarios: 3, maxDepth: 6, seed: 's' },
      bools: { hasXaiKey: true, enableXai: true, hasAnthropicKey: true, enableAnthropic: true, hasBotTests: true },
      events,
      scenarios: [],
      bundle: { provocateurHash: 'p'.repeat(16), revocateurHash: 'r'.repeat(16) },
    });
    expect(md).toContain('xAI calls: 4');
    expect(md).toContain('Anthropic calls: 8');
    expect(md).toContain('Supabase writes: 30');
    expect(md).not.toMatch(/not wired/i);
  });

  it('runXaiAdversarialBotCorpus.buildMarkdownReport reports honest zeros when no live calls happened (no "(not wired)")', () => {
    const events: Event[] = [
      { stage: 'provider_call_summary', runId: 'r', xaiCalls: 0, anthropicCalls: 0, supabaseWrites: 0 },
    ];
    const md = runner.buildMarkdownReport({
      runId: 'r', args: { dry: true, scenarios: 0, maxDepth: 6, seed: 's' },
      bools: { hasXaiKey: false, enableXai: false, hasAnthropicKey: false, enableAnthropic: false, hasBotTests: false },
      events, scenarios: [], bundle: { provocateurHash: 'p'.repeat(16), revocateurHash: 'r'.repeat(16) },
    });
    expect(md).toContain('xAI calls: 0');
    expect(md).toContain('Anthropic calls: 0');
    expect(md).toContain('Supabase writes: 0');
    expect(md).not.toMatch(/not wired/i);
  });

  it('xaiAdversarialCorpusReport.computeProviderCallTally mirrors the runner', () => {
    const events: Event[] = [
      { stage: 'provider_call_summary', runId: 'r', xaiCalls: 1, anthropicCalls: 2, supabaseWrites: 3 },
    ];
    const tally = corpusReportLib.computeProviderCallTally(events);
    expect(tally.source).toBe('provider_call_summary');
    expect(tally.xaiCalls).toBe(1);
    expect(tally.anthropicCalls).toBe(2);
    expect(tally.supabaseWrites).toBe(3);
  });

  it('runner.buildMarkdownReport contains no "(not wired in this commit)" disclaimer in any line', () => {
    const md = runner.buildMarkdownReport({
      runId: 'r', args: { dry: false, scenarios: 1, maxDepth: 6, seed: 's' },
      bools: { hasXaiKey: true, enableXai: true, hasAnthropicKey: true, enableAnthropic: true, hasBotTests: true },
      events: [], scenarios: [], bundle: { provocateurHash: 'p'.repeat(16), revocateurHash: 'r'.repeat(16) },
    });
    // Even with no provider_call_summary AND no events, the fallback
    // aggregator produces 0/0/0 — never the "(not wired)" string.
    expect(md).not.toMatch(/not wired/i);
  });
});
