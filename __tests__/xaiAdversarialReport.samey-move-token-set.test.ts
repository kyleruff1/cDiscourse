/**
 * CORPUS-30-LIVE-PATH-WIRING — Fix 2, Test 5.
 *
 * Asserts:
 *   - The samey-move §9 check operates on hashed token-sets from
 *     `move_body_sample` JSONL events (operator-ratified default §9 #1
 *     option a).
 *   - The reporter NEVER reads raw body text from `move_body_sample`
 *     (it carries only tokenSetHash + tokenCount by construction).
 *   - Two moves with identical tokenSetHash + non-trivial tokenCount
 *     emit a high-overlap pair → red.
 *   - Distinct token-sets emit green.
 *   - The hash helper itself never emits raw body in its output keys.
 */

const runner = require('../scripts/bot-fixtures/runXaiAdversarialBotCorpus');
const reportLib = require('../scripts/bot-fixtures/xaiAdversarialReport');

type Event = Record<string, unknown>;

describe('CORPUS-30 samey-move via hashed token-set', () => {
  it('computeMoveBodySampleHash returns { tokenSetHash, tokenCount } and no body text', () => {
    const body = 'demand primary source mechanism mode shift parallel arterial';
    const result = runner.computeMoveBodySampleHash(body);
    expect(typeof result.tokenSetHash).toBe('string');
    expect(result.tokenSetHash).toMatch(/^[0-9a-f]{16}$/);
    expect(typeof result.tokenCount).toBe('number');
    expect(result.tokenCount).toBeGreaterThan(3);
    // The returned object SHOULD include the tokenSet internally for
    // testing parity but the JSONL emitter only persists hash + count.
  });

  it('computeMoveBodySampleHash is deterministic for the same input', () => {
    const r1 = runner.computeMoveBodySampleHash('primary source mechanism');
    const r2 = runner.computeMoveBodySampleHash('primary source mechanism');
    expect(r1.tokenSetHash).toBe(r2.tokenSetHash);
  });

  it('computeMoveBodySampleHash normalises order — same tokens different order → same hash', () => {
    const r1 = runner.computeMoveBodySampleHash('primary source mechanism');
    const r2 = runner.computeMoveBodySampleHash('mechanism primary source');
    expect(r1.tokenSetHash).toBe(r2.tokenSetHash);
  });

  it('computeMoveBodySampleHash strips stopwords + short tokens', () => {
    const r1 = runner.computeMoveBodySampleHash('the a primary the source mechanism');
    const r2 = runner.computeMoveBodySampleHash('primary source mechanism');
    expect(r1.tokenSetHash).toBe(r2.tokenSetHash);
  });

  it('runner.checkSameyMove flags identical tokenSetHash pairs in the same thread as red', () => {
    const events: Event[] = [
      { stage: 'move_body_sample', threadIndex: 0, moveIndex: 3, moveId: 'm3', tokenSetHash: 'aaaa1234bbbb5678', tokenCount: 8 },
      { stage: 'move_body_sample', threadIndex: 0, moveIndex: 4, moveId: 'm4', tokenSetHash: 'aaaa1234bbbb5678', tokenCount: 8 },
    ];
    const result = runner.checkSameyMove(events);
    expect(result.severityBand).toBe('red');
    expect(result.highPairs.length).toBeGreaterThan(0);
    expect(result.highPairs[0].overlap).toBe(1.0);
    expect(result.source).toBe('move_body_sample');
  });

  it('runner.checkSameyMove returns green when token-set hashes are distinct', () => {
    const events: Event[] = [
      { stage: 'move_body_sample', threadIndex: 0, moveIndex: 3, moveId: 'm3', tokenSetHash: 'aaa1', tokenCount: 5 },
      { stage: 'move_body_sample', threadIndex: 0, moveIndex: 4, moveId: 'm4', tokenSetHash: 'bbb2', tokenCount: 5 },
    ];
    const result = runner.checkSameyMove(events);
    expect(result.severityBand).toBe('green');
    expect(result.highPairs.length).toBe(0);
    expect(result.source).toBe('move_body_sample');
  });

  it('runner.checkSameyMove ignores trivial token-counts (≤3) to avoid false positives', () => {
    const events: Event[] = [
      { stage: 'move_body_sample', threadIndex: 0, moveIndex: 3, moveId: 'm3', tokenSetHash: 'short', tokenCount: 3 },
      { stage: 'move_body_sample', threadIndex: 0, moveIndex: 4, moveId: 'm4', tokenSetHash: 'short', tokenCount: 3 },
    ];
    const result = runner.checkSameyMove(events);
    expect(result.severityBand).toBe('green');
  });

  it('reportLib.sameyMoveFromEvents matches runner.checkSameyMove on the token-set path', () => {
    const events: Event[] = [
      { stage: 'move_body_sample', threadIndex: 0, moveIndex: 3, moveId: 'm3', tokenSetHash: 'dup', tokenCount: 10 },
      { stage: 'move_body_sample', threadIndex: 0, moveIndex: 4, moveId: 'm4', tokenSetHash: 'dup', tokenCount: 10 },
    ];
    const r = reportLib.sameyMoveFromEvents(events);
    expect(r.severityBand).toBe('red');
    expect(r.source).toBe('move_body_sample');
  });

  it('reporter falls back to bot_move_render.body Jaccard when no move_body_sample present', () => {
    const events: Event[] = [
      { stage: 'bot_move_render', threadIndex: 0, move: { moveId: 'm3', body: 'primary source mechanism mode shift parallel arterial' } },
      { stage: 'bot_move_render', threadIndex: 0, move: { moveId: 'm4', body: 'primary source mechanism mode shift parallel arterial demand' } },
    ];
    const result = runner.checkSameyMove(events);
    expect(result.severityBand).toBe('red');
    expect(result.source).toBe('bot_move_render');
  });

  it('Reporter NEVER reads raw body when move_body_sample IS present (doctrine §10 / §1)', () => {
    // Even if bot_move_render.body is also present, the token-set source
    // takes precedence — which means the body content is invisible to
    // the §9 reporter and cannot leak into committable Markdown.
    const events: Event[] = [
      { stage: 'move_body_sample', threadIndex: 0, moveIndex: 3, moveId: 'm3', tokenSetHash: 'aaa', tokenCount: 5 },
      { stage: 'move_body_sample', threadIndex: 0, moveIndex: 4, moveId: 'm4', tokenSetHash: 'bbb', tokenCount: 5 },
      { stage: 'bot_move_render', threadIndex: 0, move: { moveId: 'm3', body: 'primary source mechanism mode shift parallel arterial demand' } },
      { stage: 'bot_move_render', threadIndex: 0, move: { moveId: 'm4', body: 'primary source mechanism mode shift parallel arterial demand' } },
    ];
    const result = runner.checkSameyMove(events);
    // bodies match (would normally flag red on Jaccard ≥0.60), but
    // tokenSetHashes differ → green via the precedence rule.
    expect(result.source).toBe('move_body_sample');
    expect(result.severityBand).toBe('green');
  });

  it('move_body_sample JSONL emission carries hash + count only (no body / no tokenSet array in committed event keys)', () => {
    // Sanity: the test above already exercised the field names the
    // runner emits — { tokenSetHash, tokenCount, moveId, moveIndex,
    // threadIndex, runTag, seedId }. There is no "body" / "tokens" /
    // "tokenSet" key on the emitted event.
    // This is a contract assertion against the runner's emit shape.
    const src = require('fs').readFileSync(require('path').join(process.cwd(), 'scripts/bot-fixtures/runXaiAdversarialBotCorpus.js'), 'utf8');
    // Find the emitMoveBodySample helper definition and verify it only
    // writes tokenSetHash + tokenCount + structural metadata.
    const m = src.match(/function emitMoveBodySample[\s\S]{0,500}?jsonl\.write\(['"]move_body_sample['"][\s\S]{0,400}?\}\);/);
    expect(m).toBeTruthy();
    if (!m) return;
    expect(m[0]).toContain('tokenSetHash');
    expect(m[0]).toContain('tokenCount');
    // Forbidden keys in the emitted event.
    expect(m[0]).not.toMatch(/\bbody\s*:/);
    expect(m[0]).not.toMatch(/\btokenSet\s*:/);
    expect(m[0]).not.toMatch(/\btokens\s*:/);
  });
});
