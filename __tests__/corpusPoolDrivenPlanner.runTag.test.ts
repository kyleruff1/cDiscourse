/**
 * CORPUS-30-POOL-DRIVEN-PLANNER §10: runTag format and runId.slice(0,8) bug fix.
 *
 * Asserts the runTag generator produces a stable, ISO-derived, suffix-bearing
 * tag — and that the bug pattern `runId.slice(0, 8)` (date-prefix collision)
 * is no longer used in the runner.
 */
import fs from 'node:fs';
import path from 'node:path';

const planner = require('../scripts/bot-fixtures/corpusPoolDrivenPlanner');

const REPO_ROOT = path.resolve(__dirname, '..');
const RUNNER_PATH = path.join(REPO_ROOT, 'scripts', 'bot-fixtures', 'runXaiAdversarialBotCorpus.js');

describe('CORPUS-30 runTag', () => {
  it('contains YYYYMMDD-HHMM and an 8-hex uuid suffix', () => {
    const runId = '2026-06-03T14-22-31-123Z-a1b2c3d4';
    const tag = planner.buildRunTag(runId, 'corpus-prod-synthetic');
    expect(tag).toBe('corpus-prod-synthetic-20260603-1422-a1b2c3d4');
    expect(tag).toMatch(/^corpus-(prod|dev)-synthetic-\d{8}-\d{4}-[a-f0-9]{8}$/);
  });

  it('produces ≤48-char tags for either kind', () => {
    const runId = '2026-06-03T14-22-31-123Z-a1b2c3d4';
    expect(planner.buildRunTag(runId, 'corpus-prod-synthetic').length).toBeLessThanOrEqual(48);
    expect(planner.buildRunTag(runId, 'corpus-dev-synthetic').length).toBeLessThanOrEqual(48);
  });

  it('does not collide when two same-minute runs have different UUID suffixes', () => {
    const a = planner.buildRunTag('2026-06-03T14-22-31-123Z-a1b2c3d4', 'corpus-prod-synthetic');
    const b = planner.buildRunTag('2026-06-03T14-22-44-987Z-deadbeef', 'corpus-prod-synthetic');
    expect(a).not.toBe(b);
    expect(a.endsWith('-a1b2c3d4')).toBe(true);
    expect(b.endsWith('-deadbeef')).toBe(true);
  });

  it('falls back to `undated` when the timestamp prefix is missing', () => {
    const tag = planner.buildRunTag('weird-id-cafef00d', 'corpus-dev-synthetic');
    expect(tag).toBe('corpus-dev-synthetic-undated-cafef00d');
  });

  it('runner does NOT use `runId.slice(0, 8)` anywhere (the original bug)', () => {
    const runner = fs.readFileSync(RUNNER_PATH, 'utf8');
    // No occurrence of the bug pattern.
    expect(runner).not.toMatch(/runId\.slice\(\s*0\s*,\s*8\s*\)/);
  });

  it('throws on empty runId or empty kind', () => {
    expect(() => planner.buildRunTag('', 'corpus-prod-synthetic')).toThrow();
    expect(() => planner.buildRunTag('2026-06-03T14-22-31-123Z-x', '')).toThrow();
  });
});
