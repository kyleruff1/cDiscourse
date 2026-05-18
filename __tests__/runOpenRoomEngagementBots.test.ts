/**
 * Stage 6.5 — Source-safety + CLI tests for runOpenRoomEngagementBots.
 *
 * These tests exercise:
 *   - The runner source file contains no secret-shape strings, no
 *     real handles / URLs / emails, no direct insert into
 *     `public.arguments`, no service-role usage, and routes posts
 *     through `submit-argument`.
 *   - CLI parsing produces the expected defaults and clamps.
 *   - `refuseLive` collects the right gates when env / pilot is
 *     missing.
 *   - `mapAxisForSubmit` collapses extended axes to the legacy set.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const runner = require('../scripts/bot-fixtures/runOpenRoomEngagementBots');
const { parseArgs, mapAxisForSubmit, refuseLive } = runner;

const RUNNER_PATH = path.join(__dirname, '..', 'scripts', 'bot-fixtures', 'runOpenRoomEngagementBots.js');
const RENDERER_PATH = path.join(__dirname, '..', 'scripts', 'bot-fixtures', 'openRoomEngagementMoveRenderer.js');

function readUtf8(file: string) {
  return fs.readFileSync(file, 'utf8');
}

describe('runOpenRoomEngagementBots — source safety scan', () => {
  it('the runner file exists and is non-empty', () => {
    const stat = fs.statSync(RUNNER_PATH);
    expect(stat.size).toBeGreaterThan(2000);
  });

  it('contains no secret-shape strings', () => {
    const src = readUtf8(RUNNER_PATH);
    expect(src).not.toMatch(/sk-ant-[A-Za-z0-9_-]{12,}/);
    expect(src).not.toMatch(/xai-[A-Za-z0-9_-]{12,}/);
    expect(src).not.toMatch(/sb_secret_[A-Za-z0-9_-]{8,}/);
    expect(src).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/);
    expect(src).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{16,}/);
    // Literal "Authorization" header string — the runner never prints one.
    expect(src).not.toMatch(/Authorization\s*:\s*Bearer\s+[A-Za-z0-9._-]{8,}/i);
  });

  it('contains no real X handles, X URLs, or real emails', () => {
    const src = readUtf8(RUNNER_PATH);
    expect(src).not.toMatch(/@[A-Za-z0-9_]{2,15}\b(?!\.com)/);
    expect(src).not.toMatch(/https?:\/\/(?:x|twitter)\.com\//);
    expect(src).not.toMatch(/https?:\/\/t\.co\//);
    expect(src).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  });

  it('never uses service-role and never direct-inserts into public.arguments', () => {
    const src = readUtf8(RUNNER_PATH);
    // No service-role env var name or wrapper function references.
    expect(src.toLowerCase()).not.toContain('service_role');
    expect(src.toLowerCase()).not.toContain('serviceroleclient');
    expect(src.toLowerCase()).not.toContain('supabase_service_role_key');
    // No `.from('arguments').insert(...)` patterns.
    expect(src).not.toMatch(/\.from\(\s*['"]arguments['"]\s*\)\s*\.insert/);
  });

  it('routes posts through submit-argument (invokeSubmitArgument)', () => {
    const src = readUtf8(RUNNER_PATH);
    expect(src).toContain("require('./submitMove')");
    expect(src).toContain('invokeSubmitArgument');
  });

  it('imports the openRoomHeatModel and the engagement renderer', () => {
    const src = readUtf8(RUNNER_PATH);
    expect(src).toContain("require('./openRoomHeatModel')");
    expect(src).toContain("require('./openRoomEngagementMoveRenderer')");
  });

  it('gates live mode behind .env.engagement-intelligence + --pilot', () => {
    const src = readUtf8(RUNNER_PATH);
    expect(src).toContain('.env.engagement-intelligence');
    expect(src).toContain('ENGAGEMENT_INTEL_ENABLE_ANTHROPIC');
    expect(src).toContain('--pilot');
  });

  it('writes its JSONL to logs/engagement-intelligence (gitignored)', () => {
    const src = readUtf8(RUNNER_PATH);
    expect(src).toContain("'engagement-intelligence'");
    expect(src).toContain('open-room-engagement.jsonl');
  });

  it('writes its Markdown summary under docs/testing-runs/', () => {
    const src = readUtf8(RUNNER_PATH);
    expect(src).toContain("'testing-runs'");
    expect(src).toContain('open-room-engagement-summary.md');
  });

  it('emits the required JSONL event types', () => {
    const src = readUtf8(RUNNER_PATH);
    for (const evt of [
      'run_start', 'skill_validation',
      'room_scan', 'room_candidate', 'room_selected',
      'bot_assignment',
      'move_prompt_built', 'move_rendered', 'move_validated',
      'submit_attempt', 'submit_result',
      'room_heat_update', 'room_summary', 'run_summary',
    ]) {
      expect(src).toContain(`'${evt}'`);
    }
  });
});

describe('runOpenRoomEngagementBots — renderer file source safety', () => {
  it('renderer file contains no secret-shape strings or real identifiers', () => {
    const src = readUtf8(RENDERER_PATH);
    expect(src).not.toMatch(/sk-ant-[A-Za-z0-9_-]{12,}/);
    expect(src).not.toMatch(/xai-[A-Za-z0-9_-]{12,}/);
    expect(src).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/);
    expect(src).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{16,}/);
    expect(src).not.toMatch(/https?:\/\/(?:x|twitter)\.com\//);
    expect(src).not.toMatch(/https?:\/\/t\.co\//);
  });

  it('renderer file does not console.log raw input bodies (only sanitised error strings)', () => {
    const src = readUtf8(RENDERER_PATH);
    // The renderer should not console.log at all (the runner owns logging).
    expect(src).not.toMatch(/console\.log\(/);
  });
});

describe('parseArgs — defaults + clamps', () => {
  it('defaults to dry mode', () => {
    const a = parseArgs(['node', 'script']);
    expect(a.dry).toBe(true);
    expect(a.pilot).toBe(false);
    expect(a.maxRooms).toBe(20);
    expect(a.targetMovesMin).toBe(8);
    expect(a.targetMovesMax).toBe(12);
    expect(a.targetCoveragePct).toBe(100);
  });

  it('--pilot disables dry mode', () => {
    const a = parseArgs(['node', 'script', '--pilot']);
    expect(a.pilot).toBe(true);
    expect(a.dry).toBe(false);
  });

  it('--target-coverage accepts decimal (0.10) and percent (10)', () => {
    const aDecimal = parseArgs(['node', 'script', '--target-coverage', '0.10']);
    const aPct = parseArgs(['node', 'script', '--target-coverage', '10']);
    expect(aDecimal.targetCoveragePct).toBe(10);
    expect(aPct.targetCoveragePct).toBe(10);
  });

  it('--target-coverage clamps to [1, 100]', () => {
    expect(parseArgs(['node', 'script', '--target-coverage', '999']).targetCoveragePct).toBe(100);
    expect(parseArgs(['node', 'script', '--target-coverage', '0']).targetCoveragePct).toBe(1);
  });

  it('honours --target-min-moves / --target-max-moves / --max-rooms', () => {
    const a = parseArgs(['node', 'script', '--target-min-moves', '15', '--target-max-moves', '25', '--max-rooms', '50']);
    expect(a.targetMovesMin).toBe(15);
    expect(a.targetMovesMax).toBe(25);
    expect(a.maxRooms).toBe(50);
  });

  it('honours --max-moves-per-room and --max-moves-total', () => {
    const a = parseArgs(['node', 'script', '--max-moves-per-room', '4', '--max-moves-total', '40']);
    expect(a.maxMovesPerRoom).toBe(4);
    expect(a.maxMovesTotal).toBe(40);
  });
});

describe('refuseLive — collects the right gates', () => {
  it('refuses with all four reasons when nothing is set', () => {
    const reasons = refuseLive(
      { pilot: false },
      { hasAnthropicKey: false, enableAnthropic: false, hasBotTests: false },
    );
    expect(reasons).toEqual(expect.arrayContaining([
      'ANTHROPIC_API_KEY missing',
      'ENGAGEMENT_INTEL_ENABLE_ANTHROPIC not true',
      '.env.bot-tests missing',
      '--pilot not set',
    ]));
  });

  it('passes with all four set', () => {
    const reasons = refuseLive(
      { pilot: true },
      { hasAnthropicKey: true, enableAnthropic: true, hasBotTests: true },
    );
    expect(reasons).toEqual([]);
  });
});

describe('mapAxisForSubmit — extended → legacy submit axes', () => {
  it('source_chain collapses to evidence', () => {
    expect(mapAxisForSubmit('source_chain')).toBe('evidence');
  });
  it('anti_amplification collapses to evidence', () => {
    expect(mapAxisForSubmit('anti_amplification')).toBe('evidence');
  });
  it('framing collapses to scope', () => {
    expect(mapAxisForSubmit('framing')).toBe('scope');
  });
  it('plain axes pass through', () => {
    for (const ax of ['fact', 'definition', 'causal', 'value', 'evidence', 'logic', 'scope']) {
      expect(mapAxisForSubmit(ax)).toBe(ax);
    }
  });
  it('null axis passes through as null', () => {
    expect(mapAxisForSubmit(null)).toBeNull();
  });
});
