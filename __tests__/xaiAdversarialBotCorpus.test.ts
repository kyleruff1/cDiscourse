/**
 * Stage 6.1.9 Phase B — adversarial bot corpus pipeline tests.
 *
 * Pure-string contract assertions + small-input behavior tests. No network.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();

const loader = require('../scripts/bot-fixtures/skillFileLoader');
const redactor = require('../scripts/engagement-intelligence/xaiSourceRedactor');
const detector = require('../scripts/engagement-intelligence/xaiDissentDetector');
const runner = require('../scripts/bot-fixtures/runXaiAdversarialBotCorpus');

// ────────────────────────────────────────────────────────────────
// skillFileLoader — reads saved files from disk + emits hashes
// ────────────────────────────────────────────────────────────────

describe('skillFileLoader — reads from disk + emits hashes', () => {
  it('loadSkillFromDisk returns the on-disk text + a 16-char hex hash', () => {
    const provoc = loader.loadSkillFromDisk('bot-provocateur');
    expect(provoc.name).toBe('bot-provocateur');
    expect(provoc.path).toBe('.claude/skills/bot-provocateur/SKILL.md');
    expect(provoc.text.length).toBeGreaterThan(500);
    expect(provoc.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(provoc.bytes).toBeGreaterThan(500);
  });

  it('loadAdversarialSkillBundle returns paths + hashes + bytes for both skills', () => {
    const bundle = loader.loadAdversarialSkillBundle();
    expect(bundle.provocateurPath).toBe('.claude/skills/bot-provocateur/SKILL.md');
    expect(bundle.revocateurPath).toBe('.claude/skills/bot-revocateur/SKILL.md');
    expect(bundle.provocateurHash).toMatch(/^[0-9a-f]{16}$/);
    expect(bundle.revocateurHash).toMatch(/^[0-9a-f]{16}$/);
    expect(bundle.provocateurBytes).toBeGreaterThan(0);
    expect(bundle.revocateurBytes).toBeGreaterThan(0);
  });

  it('redactedSkillGate strips the full text but retains paths + hashes + bytes', () => {
    const bundle = loader.loadAdversarialSkillBundle();
    const redacted = loader.redactedSkillGate(bundle, true);
    expect(redacted.validated).toBe(true);
    expect(redacted.provocateurHash).toBe(bundle.provocateurHash);
    expect(redacted.revocateurHash).toBe(bundle.revocateurHash);
    expect((redacted as { provocateurText?: string }).provocateurText).toBeUndefined();
    expect((redacted as { revocateurText?: string }).revocateurText).toBeUndefined();
  });

  it('hashes change when skill text changes (different inputs → different hashes)', () => {
    const a = loader.shortHash('skill v1 body');
    const b = loader.shortHash('skill v2 body');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(b).toMatch(/^[0-9a-f]{16}$/);
  });

  it('throws SkillFileLoadError for an unknown skill name', () => {
    expect(() => loader.loadSkillFromDisk('bot-nonexistent')).toThrow(/unknown_skill_name/);
  });
});

// ────────────────────────────────────────────────────────────────
// xaiSourceRedactor — strips identifiers + secrets + control chars
// ────────────────────────────────────────────────────────────────

describe('xaiSourceRedactor — redactRaw strips identifiers + secrets', () => {
  it('strips @handles, x.com/twitter.com/t.co URLs, raw post IDs, and emails', () => {
    const raw = '@somehandle posted at https://x.com/somehandle/status/1234567890123456789 via https://t.co/abcd and reply to user@example.com';
    const out = redactor.redactRaw(raw);
    expect(out).not.toMatch(/@somehandle/);
    expect(out).not.toMatch(/x\.com|t\.co|twitter\.com/);
    expect(out).not.toMatch(/1234567890123456789/);
    expect(out).not.toMatch(/user@example\.com/);
  });

  it('strips Anthropic / xAI / Supabase / JWT / Bearer / Authorization shapes', () => {
    const raw = 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig and sk-ant-1234567890abcdef and xai-secretkey-0123456 and sb_secret_AAA12345 and Bearer foobarbaz12345';
    const out = redactor.redactRaw(raw);
    expect(out).not.toMatch(/sk-ant-1234567890abcdef/);
    expect(out).not.toMatch(/xai-secretkey-0123456/);
    expect(out).not.toMatch(/sb_secret_AAA12345/);
    expect(out).not.toMatch(/eyJhbGciOiJIUzI1NiJ9/);
    expect(out).not.toMatch(/foobarbaz12345/);
  });

  it('handles null / undefined / empty inputs gracefully', () => {
    expect(redactor.redactRaw(null)).toBe('');
    expect(redactor.redactRaw(undefined)).toBe('');
    expect(redactor.redactRaw('')).toBe('');
  });
});

describe('xaiSourceRedactor — classifyAbuseRisk + convertHostileBody', () => {
  it('flags <threat> placeholder as high risk', () => {
    const r = redactor.classifyAbuseRisk('<threat>');
    expect(r.level).toBe('high');
    expect(r.categories).toContain('threat');
  });

  it('flags <doxx> placeholder as high risk', () => {
    const r = redactor.classifyAbuseRisk('<doxx>');
    expect(r.level).toBe('high');
    expect(r.categories).toContain('doxx');
  });

  it('flags <protected-class-attack> placeholder as high risk', () => {
    const r = redactor.classifyAbuseRisk('<protected-class-attack>');
    expect(r.level).toBe('high');
    expect(r.categories).toContain('protected_class_attack');
  });

  it('flags <sexual-abuse> placeholder as high risk', () => {
    const r = redactor.classifyAbuseRisk('<sexual-abuse>');
    expect(r.level).toBe('high');
    expect(r.categories).toContain('sexualized_abuse');
  });

  it('treats short all-caps rants as low risk (rant_only)', () => {
    const r = redactor.classifyAbuseRisk('YOU ARE WRONG WRONG WRONG NOPE');
    expect(r.level).toBe('low');
    expect(r.categories).toContain('rant_only');
  });

  it('convertHostileBody discards body when level=high', () => {
    const out = redactor.convertHostileBody('<threat>');
    expect(out.kept).toBe(false);
    expect(out.placeholder).toMatch(/high-risk/);
    expect(out.bodyForAnnotation).toBe('');
  });

  it('convertHostileBody keeps body when level=none', () => {
    const out = redactor.convertHostileBody('I narrow the scope to weekday peak hours; quote the policy text and we can go on.');
    expect(out.kept).toBe(true);
    expect(out.bodyForAnnotation.length).toBeGreaterThan(20);
  });
});

// ────────────────────────────────────────────────────────────────
// xaiDissentDetector — selects first usable dissent
// ────────────────────────────────────────────────────────────────

describe('xaiDissentDetector — classifyReply', () => {
  const source = 'Mail-in ballot drop boxes should be limited to one per county.';

  const cases: Array<[string, string, (c: Record<string, unknown>) => void]> = [
    [
      'ask_source',
      'Which audit found chain-of-custody gaps? Quote the page, not a summary.',
      (c) => { expect(c.replyFunction).toBe('ask_source'); expect(c.usableForBotDebate).toBe(true); },
    ],
    [
      'ask_quote',
      'Quote the exact section of the audit that says chain-of-custody fails at multi-box counties.',
      (c) => { expect(c.replyFunction).toBe('ask_quote'); expect(c.usableForBotDebate).toBe(true); },
    ],
    [
      'narrow_scope',
      'Narrow the scope: applies to small counties, not to a county of 4 million voters because of how scope works.',
      (c) => { expect(['narrow_scope', 'rebut']).toContain(c.replyFunction); },
    ],
    [
      'definition',
      "Define 'chain of custody' for this purpose, because without a definition this is just framing.",
      (c) => { expect(c.replyFunction).toBe('ask_definition'); expect(c.usableForBotDebate).toBe(true); },
    ],
    [
      'counterexample',
      'Counterexample: a county that consolidated to one box saw a 14% drop in turnout because elderly voters were affected.',
      (c) => { expect(c.replyFunction).toBe('counterexample'); expect(c.usableForBotDebate).toBe(true); },
    ],
    [
      'amplification_low_evidence',
      'Going viral on this one. Everyone knows it. Wake up.',
      (c) => { expect(c.amplificationRisk).not.toBe('none_observed'); expect(c.platformSupportWarning).toBe(true); },
    ],
    [
      'pure_insult',
      'lol nope',
      (c) => { expect(c.usableForBotDebate).toBe(false); },
    ],
    [
      'tangent',
      'Speaking of ballots, the absentee rejection rate is a more interesting different thread topic.',
      (c) => { expect(c.replyFunction).toBe('tangent'); expect(c.usableForBotDebate).toBe(false); },
    ],
    [
      'abuse_high',
      '<threat>',
      (c) => { expect(c.abuseRisk).toBe('high'); expect(c.usableForBotDebate).toBe(false); },
    ],
  ];

  for (const [name, replyText, assertion] of cases) {
    it(`classifies "${name}" with the expected text features`, () => {
      const c = detector.classifyReply({ sourceText: source, replyText });
      assertion(c as unknown as Record<string, unknown>);
      // Doctrine: never infers author identity, ideology, protected class.
      expect((c as { politicalValence: string }).politicalValence).toBe('describes text, not user');
    });
  }
});

describe('xaiDissentDetector — selectFirstUsableDissent prefers in-order usability', () => {
  it('returns the first usable reply (skipping unusable ones)', () => {
    const source = 'Open-source LLMs make safety harder.';
    const replies = [
      { replyOrdinal: 1, replyTextRedacted: 'lol nope' },
      { replyOrdinal: 2, replyTextRedacted: 'Everyone knows. Wake up. Going viral.' },
      { replyOrdinal: 3, replyTextRedacted: 'Quote the line where you say only attackers fine-tune away safety — the argument hangs on that.' },
      { replyOrdinal: 4, replyTextRedacted: "Define 'safety mitigation' for this. RLHF refusals or watermarks have different costs." },
    ];
    const out = detector.selectFirstUsableDissent({ sourceText: source, replies });
    expect(out.pick).not.toBeNull();
    expect(out.pick.reply.replyOrdinal).toBe(3);
    expect(out.scanned).toBe(3);
  });

  it('returns null + reason="no_usable_dissent_found" when nothing qualifies', () => {
    const source = 'Open-source LLMs make safety harder.';
    const replies = [
      { replyOrdinal: 1, replyTextRedacted: 'lol nope' },
      { replyOrdinal: 2, replyTextRedacted: 'Yes exactly.' },
      { replyOrdinal: 3, replyTextRedacted: 'Speaking of, the export-control angle is a different thread.' },
    ];
    const out = detector.selectFirstUsableDissent({ sourceText: source, replies });
    expect(out.pick).toBeNull();
    expect(out.reason).toBe('no_usable_dissent_found');
  });

  it('returns reason="no_replies" on empty input', () => {
    const out = detector.selectFirstUsableDissent({ sourceText: 'X', replies: [] });
    expect(out.pick).toBeNull();
    expect(out.reason).toBe('no_replies');
  });
});

// ────────────────────────────────────────────────────────────────
// Dry fixture shape + content
// ────────────────────────────────────────────────────────────────

describe('xai-adversarial-dry-fixture', () => {
  const fx = JSON.parse(fs.readFileSync(path.join(repoRoot, 'fixtures/engagement-intelligence/xai-adversarial-dry-fixture.json'), 'utf8'));

  it('contains exactly 10 source posts with 12 replies each', () => {
    expect(fx.sources).toHaveLength(10);
    for (const s of fx.sources) {
      expect(s.replies).toHaveLength(12);
    }
  });

  it('covers required topic buckets (politics, culture-war, sports, tech, everyday, no-dissent)', () => {
    const buckets = new Set(fx.sources.map((s: { topicBucket: string }) => s.topicBucket));
    expect(buckets.has('election-process')).toBe(true);
    expect(buckets.has('culture-war')).toBe(true);
    expect(buckets.has('sports')).toBe(true);
    expect(buckets.has('tech-platforms')).toBe(true);
    expect(buckets.has('everyday')).toBe(true);
    expect(buckets.has('no-dissent-everyday')).toBe(true);
  });

  it('includes at least one abuse_high reply (redacted placeholder only)', () => {
    let foundAbuseHigh = false;
    for (const s of fx.sources) {
      for (const r of s.replies) {
        if (r.kind === 'abuse_high') foundAbuseHigh = true;
      }
    }
    expect(foundAbuseHigh).toBe(true);
  });

  it('includes at least one ask_source + at least one ask_quote + at least one pure_insult + at least one no-dissent source', () => {
    const kinds = new Set<string>();
    for (const s of fx.sources) for (const r of s.replies) kinds.add(r.kind);
    expect(kinds.has('ask_source')).toBe(true);
    expect(kinds.has('ask_quote')).toBe(true);
    expect(kinds.has('pure_insult')).toBe(true);
    // No-dissent source: source 7 has only agree / tangent replies.
    const s7 = fx.sources[6];
    const usableKinds = s7.replies.filter((r: { kind: string }) => /^(rebut|narrow_scope|counterexample|definition|ask_source|ask_quote|ask_definition|amplification_low_evidence)$/.test(r.kind));
    expect(usableKinds.length).toBe(0);
  });

  it('contains no raw X handles, x.com/twitter.com/t.co URLs, raw emails, or JWT-shape tokens', () => {
    const blob = JSON.stringify(fx);
    expect(blob).not.toMatch(/@[A-Za-z0-9_]{2,15}\b/);
    expect(blob).not.toMatch(/https?:\/\/(x|twitter)\.com/i);
    expect(blob).not.toMatch(/https?:\/\/t\.co/i);
    expect(blob).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(blob).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(blob).not.toMatch(/sk-ant-[A-Za-z0-9]{8,}/);
    expect(blob).not.toMatch(/xai-[A-Za-z0-9]{8,}/);
  });
});

// ────────────────────────────────────────────────────────────────
// runXaiAdversarialBotCorpus — runner gating + behavior
// ────────────────────────────────────────────────────────────────

describe('runXaiAdversarialBotCorpus — runner gating', () => {
  it('parseArgs defaults to dry mode + 10 scenarios + max-depth 6', () => {
    const a = runner.parseArgs(['node', 'x']);
    expect(a.dry).toBe(true);
    expect(a.pilot).toBe(false);
    expect(a.scenarios).toBe(10);
    expect(a.maxDepth).toBe(6);
    expect(a.allowSyntheticDissent).toBe(true);
  });

  it('--pilot flips dry off; --scenarios + --max-depth are clamped to sane bounds', () => {
    const a = runner.parseArgs(['node', 'x', '--pilot', '--scenarios', '50', '--max-depth', '10']);
    expect(a.pilot).toBe(true);
    expect(a.dry).toBe(false);
    expect(a.scenarios).toBe(50);
    expect(a.maxDepth).toBe(10);
  });

  it('refuseLive enumerates every missing live gate', () => {
    const reasons = runner.refuseLive(
      { pilot: false },
      { hasXaiKey: false, enableXai: false, hasAnthropicKey: false, enableAnthropic: false, hasBotTests: false },
    );
    expect(reasons).toEqual(expect.arrayContaining([
      expect.stringContaining('XAI_API_KEY'),
      expect.stringContaining('ENGAGEMENT_INTEL_ENABLE_XAI'),
      expect.stringContaining('ANTHROPIC_API_KEY'),
      expect.stringContaining('ENGAGEMENT_INTEL_ENABLE_ANTHROPIC'),
      expect.stringContaining('.env.bot-tests'),
      expect.stringContaining('--pilot'),
    ]));
  });

  it('generateDryMove produces non-canned bodies that carry quote + axis + mechanism + evidence debt', () => {
    const move = runner.generateDryMove({
      scenario: { title: 'Mail-in ballot drop boxes should be limited to one per county.' },
      parent: { body: 'Counties with hundreds of drop boxes cannot audit chain-of-custody the same way.' },
      persona: { skillRole: 'bot-revocateur', skillHash: 'abcd1234' },
      depth: 3,
      args: { maxDepth: 6 },
    });
    expect(move.body).toMatch(/Quote/);
    expect(move.body).toMatch(/Evidence debt/);
    expect(move.disagreementAxis).toBeTruthy();
    expect(move.mechanism).toBeTruthy();
    expect(move.evidenceDebt.length).toBeGreaterThan(0);
    expect(move.antiAmplificationNote).toMatch(/popularity/);
    expect(move.skillHash).toBe('abcd1234');
    // Banned canned phrases must NOT appear.
    const lower = move.body.toLowerCase();
    expect(lower).not.toContain('counter to the previous point');
    expect(lower).not.toContain('causal disagreement is the heart of it');
    expect(lower).not.toContain('evidence is on point');
    expect(lower).not.toContain('pushing back on the rebuttal');
    expect(lower).not.toContain('narrow back to');
    expect(lower).not.toContain('on the keyword point');
  });
});

// ────────────────────────────────────────────────────────────────
// File-level safety: runner + new modules
// ────────────────────────────────────────────────────────────────

describe('Stage 6.1.9 file-level safety', () => {
  const files = [
    'scripts/bot-fixtures/runXaiAdversarialBotCorpus.js',
    'scripts/bot-fixtures/skillFileLoader.js',
    'scripts/engagement-intelligence/xaiSourceRedactor.js',
    'scripts/engagement-intelligence/xaiDissentDetector.js',
  ];

  for (const rel of files) {
    const src = fs.readFileSync(path.join(repoRoot, rel), 'utf8');

    it(`${rel} never uses SUPABASE_SERVICE_ROLE_KEY or createServiceClient`, () => {
      expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
      expect(src).not.toMatch(/createServiceClient/);
    });

    it(`${rel} never directly inserts into the arguments table`, () => {
      expect(src).not.toMatch(/\.from\(['"]arguments['"]\)\s*\.insert/);
    });

    it(`${rel} never console.logs Authorization / Bearer values`, () => {
      expect(src).not.toMatch(/console\.\w+\([^)]*Authorization[^)]*\$\{/);
      expect(src).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{16,}/);
    });

    it(`${rel} never instructs scrape / browser automation imperatively`, () => {
      // Negation-aware: lines containing "scrape" must be negated.
      for (const line of src.split(/\r?\n/)) {
        if (!/\bscrape\b|\bpuppeteer\b|\bselenium\b|\bplaywright\b|\bheadless browser\b/i.test(line)) continue;
        const lc = line.toLowerCase();
        const negated = /\b(no|never|do not|don'?t|must not|prohibited|forbidden|disallow)\b/.test(lc);
        if (!negated) throw new Error(`${rel}: imperative scrape/automation line: ${line.slice(0, 100)}`);
      }
    });
  }
});

describe('Runner contract — JSONL emission shape (dry mode)', () => {
  it('emits skill_validation + run_start + source_harvest + dissent_detection + scenario_build + bot_move_render + submit_attempt + submit_result + annotation + room_summary + run_summary', () => {
    const logsDir = path.join(repoRoot, 'logs', 'engagement-intelligence');
    if (!fs.existsSync(logsDir)) return; // no run has happened in this CI yet
    const files = fs.readdirSync(logsDir).filter((f) => f.endsWith('-xai-adversarial-semantic-corpus.jsonl'));
    if (files.length === 0) return;
    const newest = files.sort().pop()!;
    const lines = fs.readFileSync(path.join(logsDir, newest), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const stages = new Set(lines.map((l) => l.stage));
    for (const s of ['skill_validation', 'run_start', 'source_harvest', 'dissent_detection', 'scenario_build', 'bot_move_render', 'submit_attempt', 'submit_result', 'annotation', 'room_summary', 'run_summary']) {
      expect(stages.has(s)).toBe(true);
    }
    // Every event carries skillGate.
    for (const l of lines) {
      expect(l.skillGate).toBeDefined();
      expect(l.skillGate.provocateurHash).toMatch(/^[0-9a-f]{16}$/);
      expect(l.skillGate.revocateurHash).toMatch(/^[0-9a-f]{16}$/);
    }
  });
});
