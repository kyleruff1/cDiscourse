/**
 * Bot fixture runner — pure-helper unit tests.
 *
 * The runner is CommonJS (.js) under scripts/bot-fixtures/, so we require()
 * the pure helpers directly. Supabase-touching modules are NOT loaded here.
 */
import * as path from 'path';
import * as fs from 'fs';

const repoRoot = process.cwd();

const loadEnv = require(path.join(repoRoot, 'scripts/bot-fixtures/loadEnv.js'));
const loadScenario = require(path.join(repoRoot, 'scripts/bot-fixtures/loadScenario.js'));
const submitMove = require(path.join(repoRoot, 'scripts/bot-fixtures/submitMove.js'));
const writeRunLog = require(path.join(repoRoot, 'scripts/bot-fixtures/writeRunLog.js'));

describe('loadEnv helpers', () => {
  it('parseDotEnv reads simple KEY=VALUE lines', () => {
    const env = loadEnv.parseDotEnv('FOO=bar\nBAZ=qux\n');
    expect(env.FOO).toBe('bar');
    expect(env.BAZ).toBe('qux');
  });

  it('parseDotEnv ignores comments and blank lines', () => {
    const env = loadEnv.parseDotEnv('# comment\n\nA=1\n');
    expect(env.A).toBe('1');
    expect(Object.keys(env)).toHaveLength(1);
  });

  it('parseDotEnv strips quoted values', () => {
    const env = loadEnv.parseDotEnv('A="hello world"\nB=\'x\'');
    expect(env.A).toBe('hello world');
    expect(env.B).toBe('x');
  });

  it('validateRequiredKeys lists missing keys', () => {
    const missing = loadEnv.validateRequiredKeys({});
    expect(missing).toContain('EXPO_PUBLIC_SUPABASE_URL');
    expect(missing).toContain('CDISCOURSE_ADMIN_EMAIL');
    expect(missing).toContain('CDISCOURSE_BOT_A_EMAIL');
  });

  it('validateRequiredKeys returns empty when all present', () => {
    const env: Record<string, string> = {
      EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'k',
      CDISCOURSE_ADMIN_EMAIL: 'a@b.co',
      CDISCOURSE_ADMIN_PASSWORD: 'p',
      CDISCOURSE_BOT_A_EMAIL: 'x@b.co',
      CDISCOURSE_BOT_A_PASSWORD: 'p',
      CDISCOURSE_BOT_B_EMAIL: 'y@b.co',
      CDISCOURSE_BOT_B_PASSWORD: 'p',
    };
    expect(loadEnv.validateRequiredKeys(env)).toEqual([]);
  });

  it('buildBotConfig throws on missing credentials', () => {
    expect(() => loadEnv.buildBotConfig({})).toThrow(/Missing required env keys/);
  });

  it('buildBotConfig assembles bots from env', () => {
    const env: Record<string, string> = {
      EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'k',
      CDISCOURSE_ADMIN_EMAIL: 'admin@example.invalid',
      CDISCOURSE_ADMIN_PASSWORD: 'p',
      CDISCOURSE_BOT_A_EMAIL: 'a@example.invalid',
      CDISCOURSE_BOT_A_PASSWORD: 'p',
      CDISCOURSE_BOT_A_LABEL: 'bot-alpha',
      CDISCOURSE_BOT_A_PERSONA: 'calm',
      CDISCOURSE_BOT_B_EMAIL: 'b@example.invalid',
      CDISCOURSE_BOT_B_PASSWORD: 'p',
    };
    const cfg = loadEnv.buildBotConfig(env);
    expect(cfg.bots).toHaveLength(2);
    expect(cfg.bots[0].alias).toBe('bot-a');
    expect(cfg.bots[0].label).toBe('bot-alpha');
    expect(cfg.bots[0].persona).toBe('calm');
    expect(cfg.scenarioId).toBe('sports-play-in');
  });
});

describe('loadScenario helpers', () => {
  const baseScenario = {
    moves: [
      { moveId: 'm1', parentMoveId: null },
      { moveId: 'm2', parentMoveId: 'm1' },
      { moveId: 'm3', parentMoveId: 'm2' },
    ],
  };

  it('validateMoveOrdering accepts a valid scenario', () => {
    expect(loadScenario.validateMoveOrdering(baseScenario)).toEqual([]);
  });

  it('validateMoveOrdering rejects unknown parent', () => {
    const errs = loadScenario.validateMoveOrdering({
      moves: [
        { moveId: 'm1', parentMoveId: null },
        { moveId: 'm2', parentMoveId: 'missing' },
      ],
    });
    expect(errs[0]).toMatch(/unknown parent missing/);
  });

  it('validateMoveOrdering rejects zero roots', () => {
    const errs = loadScenario.validateMoveOrdering({
      moves: [{ moveId: 'm1', parentMoveId: 'm2' }, { moveId: 'm2', parentMoveId: 'm1' }],
    });
    expect(errs.some((e: string) => /no root/.test(e))).toBe(true);
  });

  it('validateMoveOrdering rejects multiple roots', () => {
    const errs = loadScenario.validateMoveOrdering({
      moves: [
        { moveId: 'm1', parentMoveId: null },
        { moveId: 'm2', parentMoveId: null },
      ],
    });
    expect(errs.some((e: string) => /2 root moves/.test(e))).toBe(true);
  });

  it('topologicalOrder places parents before children', () => {
    const reversed = {
      moves: [
        { moveId: 'm3', parentMoveId: 'm2' },
        { moveId: 'm2', parentMoveId: 'm1' },
        { moveId: 'm1', parentMoveId: null },
      ],
    };
    const out = loadScenario.topologicalOrder(reversed);
    expect(out.map((m: { moveId: string }) => m.moveId)).toEqual(['m1', 'm2', 'm3']);
  });

  it('topologicalOrder throws on cycles', () => {
    expect(() =>
      loadScenario.topologicalOrder({
        moves: [
          { moveId: 'a', parentMoveId: 'b' },
          { moveId: 'b', parentMoveId: 'a' },
        ],
      }),
    ).toThrow();
  });

  it('loads a real fixture scenario from disk', () => {
    const s = loadScenario.loadScenario('sports-play-in');
    expect(s.scenarioId).toBe('sports-play-in');
    expect(s.moves.length).toBeGreaterThan(0);
    expect(loadScenario.validateMoveOrdering(s)).toEqual([]);
  });
});

describe('submitMove helpers', () => {
  const baseMove = {
    moveId: 'm1',
    argumentType: 'claim',
    authorAlias: 'Alex',
    parentMoveId: null,
    body: 'Test body of sufficient length.',
    selectedTagCodes: [],
  };

  it('builds a basic submit body', () => {
    const body = submitMove.buildSubmitArgumentBody({
      debateId: 'd1',
      parentArgumentId: null,
      move: baseMove,
      side: 'affirmative',
      clientSubmissionId: 'sub-1',
    });
    expect(body.debate_id).toBe('d1');
    expect(body.parent_id).toBe(null);
    expect(body.argument_type).toBe('claim');
    expect(body.side).toBe('affirmative');
    expect(body.body).toBe('Test body of sufficient length.');
    expect(body.client_submission_id).toBe('sub-1');
  });

  it('auto-generates client_submission_id when not provided', () => {
    const body = submitMove.buildSubmitArgumentBody({
      debateId: 'd1',
      parentArgumentId: null,
      move: baseMove,
      side: 'affirmative',
    });
    expect(typeof body.client_submission_id).toBe('string');
    expect(body.client_submission_id.length).toBeGreaterThan(8);
  });

  it('omits target when no excerpt or axis', () => {
    const body = submitMove.buildSubmitArgumentBody({
      debateId: 'd1',
      parentArgumentId: null,
      move: baseMove,
      side: 'affirmative',
    });
    expect(body.target).toBeUndefined();
  });

  it('includes target when excerpt provided', () => {
    const body = submitMove.buildSubmitArgumentBody({
      debateId: 'd1',
      parentArgumentId: 'p1',
      move: { ...baseMove, targetExcerpt: 'specific words', disagreementAxis: 'fact' },
      side: 'negative',
    });
    expect(body.target).toEqual({ target_excerpt: 'specific words', disagreement_axis: 'fact' });
  });

  it('attaches evidence when fixture provides it', () => {
    const body = submitMove.buildSubmitArgumentBody({
      debateId: 'd1',
      parentArgumentId: 'p1',
      move: {
        ...baseMove,
        evidence: { url: 'https://example.com', label: 'study', sourceText: 'finding text' },
      },
      side: 'affirmative',
    });
    expect(body.attached_evidence).toEqual([
      { url: 'https://example.com', label: 'study', source_text: 'finding text' },
    ]);
  });

  describe('isAllowedSubmitBody', () => {
    it('accepts a whitelisted body', () => {
      const body = {
        debate_id: 'x',
        parent_id: null,
        argument_type: 'claim',
        side: 'affirmative',
        body: 'x',
        selected_tag_codes: [],
        client_submission_id: 'x',
      };
      expect(submitMove.isAllowedSubmitBody(body)).toBe(true);
    });

    it('rejects body with author_id', () => {
      expect(submitMove.isAllowedSubmitBody({ author_id: 'x' })).toBe(false);
    });

    it('rejects body with depth', () => {
      expect(submitMove.isAllowedSubmitBody({ depth: 1 })).toBe(false);
    });

    it('rejects body with status', () => {
      expect(submitMove.isAllowedSubmitBody({ status: 'posted' })).toBe(false);
    });

    it('rejects body with server_validation', () => {
      expect(submitMove.isAllowedSubmitBody({ server_validation: {} })).toBe(false);
    });

    it('rejects unknown keys', () => {
      expect(submitMove.isAllowedSubmitBody({ debate_id: 'x', evil_key: 'x' })).toBe(false);
    });
  });

  it('idempotency: same payload + same client_submission_id produces identical body', () => {
    const inputs = {
      debateId: 'd1',
      parentArgumentId: null,
      move: baseMove,
      side: 'affirmative' as const,
      clientSubmissionId: 'fixed-id',
    };
    const a = submitMove.buildSubmitArgumentBody(inputs);
    const b = submitMove.buildSubmitArgumentBody(inputs);
    expect(a).toEqual(b);
  });
});

describe('writeRunLog helpers', () => {
  it('redacts emails with aliases', () => {
    const out = writeRunLog.redactText('Hello alice@example.com!', { 'alice@example.com': 'bot-a' });
    expect(out).toBe('Hello <bot-a>!');
  });

  it('catches stray emails not in alias map', () => {
    const out = writeRunLog.redactText('contact stray@example.com', {});
    expect(out).toContain('<email>');
    expect(out).not.toContain('stray@example.com');
  });

  it('redacts JWT-shaped tokens', () => {
    const out = writeRunLog.redactText('token=eyJabcdefghij.eyJhbGciOiJIUzI1NiI', {});
    expect(out).toContain('[redacted]');
    expect(out).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  });

  it('redacts Supabase secret keys', () => {
    const out = writeRunLog.redactText('key=sb_secret_abc123def456', {});
    expect(out).toContain('[redacted]');
  });

  it('redacts Anthropic-shaped keys', () => {
    const out = writeRunLog.redactText('use sk-ant-xxxxxxx', {});
    expect(out).toContain('[redacted]');
  });

  it('formatMoveResultsTable produces markdown', () => {
    const md = writeRunLog.formatMoveResultsTable([
      { moveId: 'm1', expectedStatus: 'posted', actualStatus: 'posted', argumentId: 'a1', errorCode: null },
    ]);
    expect(md).toContain('| moveId |');
    expect(md).toContain('| m1 |');
  });
});

describe('runner source — security invariants', () => {
  /**
   * Strip comments and string literals so docstrings ("No Anthropic")
   * and redaction regexes (/sb_secret_…/) don't trigger false positives.
   * Crude but deterministic.
   */
  function stripCommentsAndStrings(src: string): string {
    return src
      // Remove /* ... */ comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove // line comments
      .replace(/\/\/.*$/gm, '')
      // Remove single-quoted strings
      .replace(/'(?:\\.|[^'\\])*'/g, "''")
      // Remove double-quoted strings
      .replace(/"(?:\\.|[^"\\])*"/g, '""')
      // Remove template literals
      .replace(/`(?:\\.|[^`\\])*`/g, '``')
      // Remove regex literals (best-effort)
      .replace(/\/(?:[^/\n\\]|\\.)+\/[gimsuy]*/g, '//');
  }

  function loadCodeOnly(rel: string): string {
    return stripCommentsAndStrings(fs.readFileSync(path.join(repoRoot, rel), 'utf8'));
  }

  it('runScenario.js does not reference SERVICE_ROLE_KEY in code', () => {
    const code = loadCodeOnly('scripts/bot-fixtures/runScenario.js');
    expect(code).not.toContain('SERVICE_ROLE_KEY');
    expect(code).not.toContain('SUPABASE_SECRET_KEYS');
    expect(code).not.toContain('sb_secret_');
  });

  it('runScenario.js does not directly insert posted arguments', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'scripts/bot-fixtures/runScenario.js'), 'utf8');
    // The runner inserts into `debates` and `debate_participants` but never `arguments`.
    expect(src).not.toMatch(/from\(['"]arguments['"]\)\s*\.insert/);
    expect(src).toContain('invokeSubmitArgument');
  });

  it('runScenario.js does not reference Anthropic in code', () => {
    const code = loadCodeOnly('scripts/bot-fixtures/runScenario.js');
    expect(code.toLowerCase()).not.toContain('anthropic');
    expect(code).not.toContain('claude-');
  });

  it('all bot-fixtures source code never uses service-role keys', () => {
    const files = fs.readdirSync(path.join(repoRoot, 'scripts/bot-fixtures'));
    for (const f of files) {
      const code = loadCodeOnly(path.join('scripts/bot-fixtures', f));
      expect(code).not.toContain('SERVICE_ROLE_KEY');
      // Note: writeRunLog.js contains an `sb_secret_` redaction regex (in a
      // string/regex literal). stripCommentsAndStrings removes regex literals
      // so this check confirms no executable code uses the key.
      expect(code).not.toMatch(/sb_secret_[A-Za-z0-9]/);
    }
  });
});
