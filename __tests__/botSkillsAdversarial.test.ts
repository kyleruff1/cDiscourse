/**
 * Stage 6.1.9 — bot skills adversarial gate tests.
 *
 * Asserts that the two skill files exist on disk, parse through the
 * shared validator without issues, contain every required content
 * marker, enumerate every banned canned phrase + every forbidden user
 * label, and contain no secret-shape or raw X identifier strings.
 *
 * These tests run against the saved files — never against in-memory
 * copies — so they catch the case where the skill body drifts from the
 * doctrine after editing.
 */
import * as fs from 'fs';
import * as path from 'path';

const validator = require('../scripts/skills/validateBotSkills');

const SKILLS = [
  { name: 'bot-provocateur', file: path.join(process.cwd(), '.claude/skills/bot-provocateur/SKILL.md') },
  { name: 'bot-revocateur', file: path.join(process.cwd(), '.claude/skills/bot-revocateur/SKILL.md') },
];

describe('Bot skill files exist + parse cleanly', () => {
  for (const skill of SKILLS) {
    it(`${skill.name}: file exists`, () => {
      expect(fs.existsSync(skill.file)).toBe(true);
    });

    it(`${skill.name}: passes validateBotSkills with zero issues`, () => {
      const res = validator.validateOne({ name: skill.name, path: skill.file });
      if (!res.ok) {
        // Surface the issue list in the test output so the gate is debuggable.
        // eslint-disable-next-line no-console
        console.error(`${skill.name} validator issues:\n${res.issues.join('\n')}`);
      }
      expect(res.ok).toBe(true);
      expect(res.issues).toEqual([]);
    });

    it(`${skill.name}: frontmatter declares effort: high`, () => {
      const text = fs.readFileSync(skill.file, 'utf8');
      const fm = validator.parseFrontmatter(text, skill.file).fm;
      expect(fm).not.toBeNull();
      expect(fm.effort).toBe('high');
      expect(String(fm['disable-model-invocation']).toLowerCase()).toBe('true');
      expect(String(fm['user-invocable']).toLowerCase()).toBe('true');
      expect(fm.name).toBe(skill.name);
    });
  }
});

describe('Bot skill files — required content (A2.4)', () => {
  for (const skill of SKILLS) {
    const text = fs.readFileSync(skill.file, 'utf8').toLowerCase();
    const markers: string[] = validator.REQUIRED_CONTENT_MARKERS;
    for (const marker of markers) {
      it(`${skill.name} includes "${marker}"`, () => {
        expect(text).toContain(marker.toLowerCase());
      });
    }
  }
});

describe('Bot skill files — banned canned phrases are listed (A2.5)', () => {
  for (const skill of SKILLS) {
    const text = fs.readFileSync(skill.file, 'utf8');
    const phrases: string[] = validator.BANNED_CANNED_PHRASES;
    for (const phrase of phrases) {
      it(`${skill.name} enumerates banned phrase "${phrase}"`, () => {
        expect(text).toContain(phrase);
      });
    }
  }
});

describe('Bot skill files — forbidden speaker labels are listed', () => {
  for (const skill of SKILLS) {
    const text = fs.readFileSync(skill.file, 'utf8').toLowerCase();
    const labels: string[] = validator.FORBIDDEN_USER_LABELS;
    for (const label of labels) {
      it(`${skill.name} prohibits speaker label "${label}"`, () => {
        expect(text).toContain(label.toLowerCase());
      });
    }
  }
});

describe('Bot skill files — safety (no secrets, no raw identifiers, no scrape imperative)', () => {
  for (const skill of SKILLS) {
    const text = fs.readFileSync(skill.file, 'utf8');

    it(`${skill.name} contains no Anthropic / xAI / Supabase / JWT / Bearer secret-shape strings`, () => {
      for (const { re, name } of validator.SECRET_LIKE_PATTERNS) {
        re.lastIndex = 0;
        if (re.test(text)) throw new Error(`secret-shape match (${name})`);
      }
    });

    it(`${skill.name} contains no real X handles, x.com/twitter.com/t.co URLs, or emails`, () => {
      for (const { re, name } of validator.X_IDENTIFIER_PATTERNS) {
        re.lastIndex = 0;
        if (re.test(text)) throw new Error(`raw X identifier (${name})`);
      }
    });

    it(`${skill.name} contains no imperative scrape / browser-automation instructions`, () => {
      const lines = text.split(/\r?\n/);
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        const isNegated = /\b(no|never|do not|don'?t|must not|prohibited|forbidden|disallow)\b/i.test(line);
        if (isNegated) continue;
        for (const { re, name } of validator.SCRAPE_IMPERATIVE_PATTERNS) {
          if (re.test(line)) throw new Error(`imperative ${name} in line: ${line.slice(0, 80)}`);
        }
      }
    });
  }
});

describe('Bot skill files — doctrine assertions', () => {
  for (const skill of SKILLS) {
    const text = fs.readFileSync(skill.file, 'utf8');
    const lower = text.toLowerCase();

    it(`${skill.name} carries the xAI/X-derived dev/test source-material exception`, () => {
      expect(lower).toMatch(/xai\/x-derived source-material/);
      expect(lower).toMatch(/dev\/test/);
    });

    it(`${skill.name} carries the source-chain challenge language`, () => {
      expect(lower).toContain('source-chain');
      expect(lower).toMatch(/primary\s+(record|source)/);
    });

    it(`${skill.name} carries the anti-amplification doctrine`, () => {
      expect(lower).toContain('anti-amplification');
      expect(lower).toContain('popularity is not evidence');
    });

    it(`${skill.name} carries the hostile-source conversion rules`, () => {
      expect(lower).toContain('hostile source');
      expect(lower).toMatch(/redact/);
      expect(lower).toMatch(/never reproduce|do not reproduce/);
    });

    it(`${skill.name} requires the minimum specificity contract (quote/axis/mechanism/evidence debt)`, () => {
      expect(lower).toMatch(/quote/);
      expect(lower).toMatch(/axis/);
      expect(lower).toMatch(/mechanism/);
      expect(lower).toMatch(/evidence debt/);
      expect(lower).toMatch(/minimum specificity contract/);
    });

    it(`${skill.name} preserves the no-service-role / no-direct-insert / submit-argument-only constraints`, () => {
      expect(lower).toContain('service-role');
      expect(lower).toContain('direct insert');
      expect(lower).toContain('submit-argument');
      expect(lower).toMatch(/never\s+(bypass|use)|no\s+(bypass|service-role)/);
    });

    it(`${skill.name} bans canned phrases AND speaker labels explicitly`, () => {
      for (const phrase of validator.BANNED_CANNED_PHRASES) {
        expect(text).toContain(phrase);
      }
      for (const label of validator.FORBIDDEN_USER_LABELS) {
        expect(lower).toContain(label.toLowerCase());
      }
    });

    it(`${skill.name} never claims X popularity / virality is evidence`, () => {
      expect(lower).not.toMatch(/popularity\s+(is|counts as|equals)\s+evidence/);
      expect(lower).not.toMatch(/virality\s+(is|counts as|equals)\s+evidence/);
      expect(lower).not.toMatch(/x\s+popularity\s+is\s+evidence/);
    });

    it(`${skill.name} explicitly tells the bot not to pretend to be human`, () => {
      expect(lower).toContain('do not pretend to be human');
    });
  }
});
