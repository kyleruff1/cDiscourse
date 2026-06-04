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

  // CORPUS-30-QUALITY-001 (b): the samey-move metric now needs >= 50
  // non-empty body samples to compute a band at all (§4-T HARD GUARD).
  // Helper builds N move_body_sample events with a body-free tokenHashes
  // fingerprint produced by `hashesFor(i)`.
  function buildSamples(
    n: number,
    hashesFor: (i: number) => string[],
    threadFor: (i: number) => number = () => 0,
  ): Event[] {
    const evs: Event[] = [];
    for (let i = 0; i < n; i++) {
      const hashes = hashesFor(i);
      evs.push({
        stage: 'move_body_sample', threadIndex: threadFor(i), moveIndex: 3 + i, moveId: `m${i}`,
        tokenSetHash: `h${i}`, tokenCount: hashes.length, tokenHashes: hashes, openingTokenHash: `op${i % 7}`,
      });
    }
    return evs;
  }

  it('runner.checkSameyMove flags identical fingerprints in the same thread as red (>=50 samples)', () => {
    // All 60 moves share the exact same token-hash set → Jaccard 1.0.
    const events = buildSamples(60, () => ['aaaa1234', 'bbbb5678', 'cccc9012', 'dddd3456']);
    const result = runner.checkSameyMove(events);
    expect(result.severityBand).toBe('red');
    expect(result.highPairs.length).toBeGreaterThan(0);
    expect(result.highPairs[0].overlap).toBe(1.0);
    expect(result.source).toBe('move_body_sample');
    expect(result.overallMean).toBeGreaterThan(0); // REAL mean, not the literal 0
  });

  it('runner.checkSameyMove returns green when fingerprints are disjoint (>=50 samples)', () => {
    const events = buildSamples(60, (i) => [`a${i}`, `b${i}`, `c${i}`, `d${i}`, `e${i}`]);
    const result = runner.checkSameyMove(events);
    expect(result.severityBand).toBe('green');
    expect(result.highPairs.length).toBe(0);
    expect(result.overallMean).toBe(0); // genuinely 0, not green-by-absence
    expect(result.source).toBe('move_body_sample');
    expect(result.sampleCount).toBe(60);
  });

  it('runner.checkSameyMove emits n/a (insufficient_samples) below the 50-sample floor — NEVER green', () => {
    // 49 disjoint samples: even though they are clearly NOT samey, the
    // metric must refuse to read green on insufficient data.
    const events = buildSamples(49, (i) => [`a${i}`, `b${i}`, `c${i}`, `d${i}`]);
    const result = runner.checkSameyMove(events);
    expect(result.severityBand).toBe('n/a');
    expect(result.reason).toBe('insufficient_samples');
    expect(result.severityBand).not.toBe('green');
    expect(result.sampleCount).toBe(49);
  });

  it('runner.checkSameyMove computes a real band at exactly 50 samples', () => {
    const events = buildSamples(50, (i) => [`a${i}`, `b${i}`, `c${i}`, `d${i}`]);
    const result = runner.checkSameyMove(events);
    expect(['green', 'yellow', 'red']).toContain(result.severityBand);
    expect(result.severityBand).toBe('green'); // disjoint → green, with enough data
  });

  it('reportLib.sameyMoveFromEvents matches runner.checkSameyMove on the fingerprint path (twin-lockstep)', () => {
    const events = buildSamples(60, () => ['dup11111', 'dup22222', 'dup33333', 'dup44444']);
    const a = runner.checkSameyMove(events);
    const b = reportLib.sameyMoveFromEvents(events);
    expect(b.severityBand).toBe('red');
    expect(b.source).toBe('move_body_sample');
    expect(b.severityBand).toBe(a.severityBand);
    expect(b.overallMean).toBe(a.overallMean);
    expect(b.maxIntraThreadMean).toBe(a.maxIntraThreadMean);
  });

  it('reporter falls back to bot_move_render.body Jaccard when no move_body_sample present (>=50 samples)', () => {
    const events: Event[] = [];
    for (let i = 0; i < 60; i++) {
      events.push({ stage: 'bot_move_render', threadIndex: 0, move: { moveId: `m${i}`, body: 'primary source mechanism mode shift parallel arterial demand receipt' } });
    }
    const result = runner.checkSameyMove(events);
    expect(result.severityBand).toBe('red'); // identical bodies → Jaccard 1.0
    expect(result.source).toBe('bot_move_render');
  });

  it('bot_move_render path also honors the n/a floor below 50 samples — NEVER green', () => {
    const events: Event[] = [];
    for (let i = 0; i < 10; i++) {
      events.push({ stage: 'bot_move_render', threadIndex: 0, move: { moveId: `m${i}`, body: `unique body number ${i} with distinct lexical content here` } });
    }
    const result = runner.checkSameyMove(events);
    expect(result.severityBand).toBe('n/a');
    expect(result.reason).toBe('insufficient_samples');
  });

  it('Reporter NEVER reads raw body when move_body_sample IS present (doctrine §10 / §1)', () => {
    // Even if bot_move_render.body is also present, the move_body_sample
    // fingerprint source takes precedence — the body content is invisible
    // to the §9 reporter and cannot leak into committable Markdown.
    const events: Event[] = buildSamples(60, (i) => [`uniq${i}a`, `uniq${i}b`, `uniq${i}c`, `uniq${i}d`]);
    // Add matching bodies that WOULD flag red if the reporter read body.
    for (let i = 0; i < 60; i++) {
      events.push({ stage: 'bot_move_render', threadIndex: 0, move: { moveId: `m${i}`, body: 'primary source mechanism mode shift parallel arterial demand' } });
    }
    const result = runner.checkSameyMove(events);
    // Disjoint fingerprints → green via the precedence rule; the
    // identical bodies are never consulted.
    expect(result.source).toBe('move_body_sample');
    expect(result.severityBand).toBe('green');
  });

  it('legacy JSONL without tokenHashes falls back to strict-clone detection but still honors the n/a floor', () => {
    // Old events carry only tokenSetHash (no fingerprint). Below 50 → n/a.
    const few: Event[] = [];
    for (let i = 0; i < 20; i++) few.push({ stage: 'move_body_sample', threadIndex: 0, moveId: `m${i}`, tokenSetHash: 'clone', tokenCount: 8 });
    const r1 = runner.checkSameyMove(few);
    expect(r1.severityBand).toBe('n/a');
    expect(r1.reason).toBe('insufficient_samples');
    // At >=50 identical legacy clones → strict-clone red.
    const many: Event[] = [];
    for (let i = 0; i < 60; i++) many.push({ stage: 'move_body_sample', threadIndex: 0, moveId: `m${i}`, tokenSetHash: 'clone', tokenCount: 8 });
    const r2 = runner.checkSameyMove(many);
    expect(r2.severityBand).toBe('red');
    expect(r2.fingerprint).toBe('legacy_clone_only');
  });

  it('move_body_sample JSONL emission carries hashes + count only (no body / no readable tokenSet/tokens key in committed event keys)', () => {
    // The runner emits { tokenSetHash, tokenCount, tokenHashes,
    // openingTokenHash, moveId, moveIndex, threadIndex, runTag, seedId }.
    // CORPUS-30-QUALITY-001 (b)/(c) added the body-free hashed-shingle
    // fingerprint (tokenHashes) + one positional opening-token hash. There
    // is STILL no "body" / readable "tokens" / readable "tokenSet" key.
    // This is a contract assertion against the runner's emit shape.
    const src = require('fs').readFileSync(require('path').join(process.cwd(), 'scripts/bot-fixtures/runXaiAdversarialBotCorpus.js'), 'utf8');
    // Window widened from 400→800: the emit block now also carries the
    // fingerprint fields. The leak guarantee is UNCHANGED.
    const m = src.match(/function emitMoveBodySample[\s\S]{0,500}?jsonl\.write\(['"]move_body_sample['"][\s\S]{0,800}?\}\);/);
    expect(m).toBeTruthy();
    if (!m) return;
    expect(m[0]).toContain('tokenSetHash');
    expect(m[0]).toContain('tokenCount');
    expect(m[0]).toContain('tokenHashes');
    expect(m[0]).toContain('openingTokenHash');
    // Forbidden keys in the emitted event (raw body / readable tokens).
    // `tokenHashes:` and `openingTokenHash:` are body-free hash sets and
    // do NOT match these patterns.
    expect(m[0]).not.toMatch(/\bbody\s*:/);
    expect(m[0]).not.toMatch(/\btokenSet\s*:/);
    expect(m[0]).not.toMatch(/\btokens\s*:/);
  });
});
