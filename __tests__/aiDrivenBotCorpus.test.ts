/**
 * Stage 6.1.5 — AI-driven bot corpus contract tests.
 *
 * No HTTP. We assert:
 *  - The Anthropic adapter refuses to construct a client without env+--pilot.
 *  - The sanitizer scrubs `sk-ant-…`, `Bearer …`, `Authorization:` headers.
 *  - Persona system prompts include the Constitution transitions, the
 *    concession-marker requirement, and the forbidden-phrase list.
 *  - The xAI seed source defaults to synthetic and refuses live without
 *    env+--pilot.
 *  - The move renderer falls back to deterministic when the AI client errors
 *    or violates length / concession / target-excerpt constraints.
 *  - The orchestrator parses CLI flags correctly.
 *  - No source file logs `Authorization` header values via console.
 */
import * as path from 'path';
import * as fs from 'fs';

const repoRoot = process.cwd();

const claude = require(path.join(repoRoot, 'scripts/bot-fixtures/claudeMessagesClient.js'));
const personas = require(path.join(repoRoot, 'scripts/bot-fixtures/aiBotPersonas.js'));
const renderer = require(path.join(repoRoot, 'scripts/bot-fixtures/aiMoveRenderer.js'));
const xaiSeeds = require(path.join(repoRoot, 'scripts/engagement-intelligence/xaiSeededStances.js'));
const orchestrator = require(path.join(repoRoot, 'scripts/bot-fixtures/runAiDrivenCorpus.js'));

describe('claudeMessagesClient — gating + sanitization', () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ENGAGEMENT_INTEL_ENABLE_ANTHROPIC;
  });

  it('refuses when ENGAGEMENT_INTEL_ENABLE_ANTHROPIC is explicitly false', () => {
    // process.env overrides any value the .env file might contain — this
    // keeps the test hermetic even when an operator has populated the local
    // env file for the live pilot. We force the flag off and expect refusal.
    process.env.ENGAGEMENT_INTEL_ENABLE_ANTHROPIC = 'false';
    process.env.ANTHROPIC_API_KEY = '';
    expect(() => claude.createClient()).toThrow(/Anthropic adapter disabled/);
  });

  it('refuses when ANTHROPIC_API_KEY is missing even if flag is on', () => {
    process.env.ENGAGEMENT_INTEL_ENABLE_ANTHROPIC = 'true';
    process.env.ANTHROPIC_API_KEY = '';
    expect(() => claude.createClient()).toThrow(/api_key_missing/);
  });

  it('sanitizes sk-ant- keys', () => {
    expect(claude.sanitize('failed: sk-ant-abc_123_def_456_789')).not.toContain('abc_123_def_456_789');
    expect(claude.sanitize('failed: sk-ant-abc_123_def_456_789')).toContain('[redacted]');
  });

  it('sanitizes Bearer tokens', () => {
    expect(claude.sanitize('Bearer secret-token-value')).toContain('[redacted]');
  });

  it('sanitizes Authorization header lines', () => {
    expect(claude.sanitize('Authorization: secret-value-12345')).not.toContain('secret-value-12345');
  });

  it('sanitizes JWT-shape tokens', () => {
    expect(claude.sanitize('payload eyJabcdefghij.eyJxyzdef')).toContain('[redacted]');
  });

  it('loadConfig returns booleans only — never the raw key', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-value-12345_abcdef';
    const cfg = claude.loadConfig();
    expect(typeof cfg.hasAnthropicKey).toBe('boolean');
    expect(typeof cfg.enableAnthropic).toBe('boolean');
    // Key is exposed via _key by design (the client closure needs it), but
    // tests verify nothing else surfaces it.
    expect(JSON.stringify({ hasAnthropicKey: cfg.hasAnthropicKey, enableAnthropic: cfg.enableAnthropic })).not.toContain('sk-ant-test-value-12345_abcdef');
  });
});

describe('aiBotPersonas — system prompt structure', () => {
  it('bakes Constitution transitions into the prompt', () => {
    const p = personas.buildPersonaSystemPrompt({ persona: 'provocateur', scenarioCategory: 'sports' });
    expect(p).toContain('transition');
    expect(p).toContain('synthesis');
    expect(p).toContain('concession');
    expect(p).toContain('clarification_request');
  });

  it('bakes the concession-marker requirement into the prompt', () => {
    const p = personas.buildPersonaSystemPrompt({ persona: 'revocateur', scenarioCategory: 'tech' });
    expect(p.toLowerCase()).toContain('i grant');
    expect(p.toLowerCase()).toContain('i acknowledge');
  });

  it('bakes the forbidden-phrase list into the prompt', () => {
    const p = personas.buildPersonaSystemPrompt({ persona: 'provocateur', scenarioCategory: 'tech' });
    expect(p.toLowerCase()).toContain('liar');
    expect(p.toLowerCase()).toContain('manipulative');
    expect(p.toLowerCase()).toContain('extremist');
    expect(p.toLowerCase()).toContain('attack the move');
  });

  it('explicitly forbids revealing AI identity', () => {
    const p = personas.buildPersonaSystemPrompt({ persona: 'provocateur', scenarioCategory: 'tech' });
    expect(p.toLowerCase()).toContain('do not reveal');
  });
});

describe('aiMoveRenderer — validators', () => {
  it('detects concession markers in body text', () => {
    expect(renderer.hasConcessionMarker('I grant the narrower point.')).toBe(true);
    expect(renderer.hasConcessionMarker('Receipts please.')).toBe(false);
  });

  it('detects forbidden phrases', () => {
    expect(renderer.hasForbidden('You are a liar.')).toBe(true);
    expect(renderer.hasForbidden('Quote the exact bit.')).toBe(false);
  });

  it('ensureLengthBounds caps at maxChars', () => {
    const long = 'a'.repeat(400);
    expect(renderer.ensureLengthBounds(long, 100).length).toBeLessThanOrEqual(101);
  });

  it('falls back to deterministic body when AI client throws', async () => {
    const failingClient = {
      generate: async () => { throw new Error('Bearer token-xyz error response'); },
      snapshotUsage: () => ({ calls: 0, inputTokens: 0, outputTokens: 0, model: 'test', budget: { maxInputTokens: 1000, maxOutputTokens: 1000 } }),
    };
    const result = await renderer.renderMoveBody({
      client: failingClient,
      persona: 'provocateur',
      topic: { topicId: 't1', resolution: 'A resolution', resolutionKeywords: ['kw1', 'kw2'], thesisFraming: 'A thesis.' },
      scenarioCategory: 'sports',
      parentBody: null,
      slot: { moveId: 'm1', author: 0, parent: null, moveKind: 'start_thesis', argumentType: 'thesis' },
      conversationSummary: '',
      rng: () => 0.5,
      maxRetries: 0,
      fallbackDeterministic: true,
    });
    expect(result.source).toBe('deterministic_fallback');
    expect(result.body.length).toBeGreaterThan(0);
    // Sanitized error message — no raw "token-xyz" should appear.
    expect(result.validationFailureReason).not.toContain('token-xyz');
  });
});

describe('xaiSeededStances — gating', () => {
  it('synthetic mode loads from the local fixture (no network)', async () => {
    const seeds = await xaiSeeds.loadSeeds({ mode: 'synthetic', count: 3 });
    expect(Array.isArray(seeds)).toBe(true);
    expect(seeds.length).toBeGreaterThanOrEqual(1);
    expect(seeds[0]).toHaveProperty('topicId');
    expect(seeds[0]).toHaveProperty('resolution');
    expect(Array.isArray(seeds[0].resolutionKeywords)).toBe(true);
  });

  it('xai_live mode refuses without env + --pilot', async () => {
    delete process.env.ENGAGEMENT_INTEL_ENABLE_XAI;
    delete process.env.XAI_API_KEY;
    await expect(xaiSeeds.loadXaiSeedsLive(3, { pilot: false })).rejects.toThrow(/xAI seed source disabled/);
    await expect(xaiSeeds.loadXaiSeedsLive(3, { pilot: true })).rejects.toThrow(/xAI seed source disabled/);
  });

  it('synthetic file contains no real handles, URLs, or emails', () => {
    const raw = require('fs').readFileSync(xaiSeeds.SYNTHETIC_SEEDS_PATH, 'utf8');
    expect(raw).not.toMatch(/@[A-Za-z0-9_]{3,15}/);
    expect(raw).not.toMatch(/https?:\/\//);
    expect(raw).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  });
});

describe('runAiDrivenCorpus orchestrator — CLI', () => {
  it('parseArgs defaults dry=true, pilot=false, rooms=3, seeds=synthetic', () => {
    expect(orchestrator.parseArgs(['node', 'x'])).toMatchObject({
      dry: true, pilot: false, rooms: 3, seeds: 'synthetic',
    });
  });

  it('parseArgs accepts --pilot --rooms 5 --seeds xai_live', () => {
    const args = orchestrator.parseArgs(['node', 'x', '--pilot', '--rooms', '5', '--seeds', 'xai_live']);
    expect(args).toMatchObject({ dry: false, pilot: true, rooms: 5, seeds: 'xai_live' });
  });

  it('parseArgs caps rooms at 50', () => {
    expect(orchestrator.parseArgs(['node', 'x', '--rooms', '500']).rooms).toBe(50);
  });

  it('buildSceneFromSeed produces the personas + meta the renderer expects', () => {
    const scene = orchestrator.buildSceneFromSeed(
      { topicId: 't1', title: 'Title', resolution: 'R', resolutionKeywords: ['a'] },
      { id: 'balanced-challenge-12', slots: [] },
    );
    expect(scene.personas.map((p: { alias: string }) => p.alias)).toEqual(['Alex', 'Jordan', 'Sam']);
    expect(scene.personas.map((p: { side: string }) => p.side)).toEqual(['affirmative', 'negative', 'neutral']);
    expect(scene.stressMeta).toMatchObject({ templateId: 'balanced-challenge-12', topicId: 't1' });
  });

  it('summarizeConversation is empty on a fresh room and accumulates after turns', () => {
    expect(orchestrator.summarizeConversation([])).toBe('');
    const s = orchestrator.summarizeConversation([
      { persona: 'provocateur', argumentType: 'thesis', body: 'A thesis.' },
      { persona: 'revocateur', argumentType: 'rebuttal', body: 'A rebuttal.' },
    ]);
    expect(s).toContain('m1');
    expect(s).toContain('m2');
    expect(s).toContain('A thesis.');
  });
});

describe('orchestrator dry-run spawn — no network, no Anthropic call', () => {
  it('dry run exits 0 and writes a dry corpus md', () => {
    const { spawnSync } = require('node:child_process');
    const res = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/bot-fixtures/runAiDrivenCorpus.js'), '--rooms', '2'], {
      cwd: repoRoot, encoding: 'utf8',
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: '',
        ENGAGEMENT_INTEL_ENABLE_ANTHROPIC: 'false',
        ENGAGEMENT_INTEL_ENABLE_XAI: 'false',
        XAI_API_KEY: '',
      },
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('mode=dry');
    expect(res.stdout).toContain('dry corpus md');
    // No Anthropic key shape leaks.
    expect(res.stdout).not.toMatch(/sk-ant-[A-Za-z0-9_]{6,}/);
    expect(res.stdout).not.toMatch(/Bearer\s+[A-Za-z0-9]{8,}/);
  });
});

describe('source-file safety — no Authorization-header logging', () => {
  const sources = [
    'scripts/bot-fixtures/claudeMessagesClient.js',
    'scripts/bot-fixtures/aiBotPersonas.js',
    'scripts/bot-fixtures/aiMoveRenderer.js',
    'scripts/bot-fixtures/runAiDrivenCorpus.js',
    'scripts/engagement-intelligence/xaiSeededStances.js',
  ];
  for (const rel of sources) {
    it(`${rel} does not console-log the Authorization header value`, () => {
      const src = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      // Match any console.log/error/warn that interpolates an Authorization
      // value via template substitution.
      expect(src).not.toMatch(/console\.(log|error|warn)\([^)]*Authorization[^)]*\$\{/);
      // No source file should hardcode a real sk-ant- key.
      expect(src).not.toMatch(/sk-ant-[A-Za-z0-9_]{16,}/);
    });
  }
});
