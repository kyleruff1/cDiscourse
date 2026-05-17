/**
 * Stage 6.1.7 follow-up — claudeMessagesClient budget pre-flight tests.
 *
 * The earlier post-flight budget check silently exhausted the input cap
 * during the 50-room corpus run, leaving every annotation as a
 * deterministic fallback. Pre-flight now refuses the HTTP call instead.
 *
 * No real network. We mock global fetch via a local override.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();
const src = fs.readFileSync(path.join(repoRoot, 'scripts/bot-fixtures/claudeMessagesClient.js'), 'utf8');

describe('claudeMessagesClient — Stage 6.1.7 budget posture', () => {
  it('DEFAULT_BUDGET ceilings are sized for a 50-room corpus run', () => {
    // 8M input + 500k output is the new floor — anything below 1M / 100k is
    // the old "tiny pilot" sizing that silently broke annotations.
    const inputMatch = src.match(/maxInputTokens:\s*([\d_]+)/);
    const outputMatch = src.match(/maxOutputTokens:\s*([\d_]+)/);
    expect(inputMatch).not.toBeNull();
    expect(outputMatch).not.toBeNull();
    const inputCap = Number(String(inputMatch![1]).replace(/_/g, ''));
    const outputCap = Number(String(outputMatch![1]).replace(/_/g, ''));
    expect(inputCap).toBeGreaterThanOrEqual(5_000_000);
    expect(outputCap).toBeGreaterThanOrEqual(300_000);
  });

  it('budget is checked PRE-flight on input (not after the HTTP call)', () => {
    const preflight = src.indexOf('// Pre-flight budget check');
    const fetchCall = src.indexOf('await fetch(');
    expect(preflight).toBeGreaterThan(0);
    expect(preflight).toBeLessThan(fetchCall);
    // The pre-flight block must mention BOTH output projection AND
    // accumulated input — the old version only checked output.
    expect(src).toMatch(/spent\.outputTokens \+ requestedMax > budget\.maxOutputTokens/);
    expect(src).toMatch(/spent\.inputTokens > budget\.maxInputTokens/);
  });

  it('post-flight throw on accumulated input has been removed', () => {
    // The old code had a SECOND `throw new AnthropicBudgetExceededError`
    // after `spent.inputTokens += …`. Stage 6.1.7 follow-up removed it.
    const afterIncrement = src.indexOf('spent.inputTokens +=');
    const tail = src.slice(afterIncrement, afterIncrement + 800);
    expect(tail).not.toMatch(/throw new AnthropicBudgetExceededError/);
    expect(tail).toMatch(/Post-flight check removed/);
  });
});

describe('anthropicArgumentAnnotator — surfaces failure reasons in fallback', () => {
  const annSrc = fs.readFileSync(path.join(repoRoot, 'scripts/bot-fixtures/anthropicArgumentAnnotator.js'), 'utf8');

  it('captures the first-attempt failure reason instead of silently discarding it', () => {
    expect(annSrc).toContain('firstReason = sanitizeAnnotationError(err)');
    expect(annSrc).toMatch(/firstReason = parsed \? 'invalid_shape' : 'unparseable_json'/);
  });

  it('captures the retry failure reason and threads BOTH into the fallback', () => {
    expect(annSrc).toContain("retryReason = sanitizeAnnotationError(err)");
    expect(annSrc).toMatch(/retryReason = parsed \? 'invalid_shape_retry' : 'unparseable_json_retry'/);
    expect(annSrc).toMatch(/anthropic_invalid_or_error: first=\$\{firstReason/);
    expect(annSrc).toMatch(/retry=\$\{retryReason/);
  });
});
