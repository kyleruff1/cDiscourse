/**
 * Validates `.claude/skills/storyline-narrative-officer/SKILL.md`.
 *
 * The repo skill gate (`scripts/skills/validateBotSkills.js`) only covers the
 * two bot skills — extending its SKILLS array would change the validator's
 * hard-gate surface. This targeted suite instead reuses the validator's pure
 * helpers (`parseFrontmatter`, `checkStructure`, `checkSafety`) and adds the
 * storyline-narrative-officer-specific content checks.
 */
const fs = require('fs');
const path = require('path');

const validator = require('../scripts/skills/validateBotSkills.js');

const SKILL_PATH = path.resolve(
  __dirname,
  '..',
  '.claude',
  'skills',
  'storyline-narrative-officer',
  'SKILL.md',
);
const SKILL_NAME = 'storyline-narrative-officer';

describe('storyline-narrative-officer skill — existence', () => {
  it('the SKILL.md file exists', () => {
    expect(fs.existsSync(SKILL_PATH)).toBe(true);
  });
});

describe('storyline-narrative-officer skill — frontmatter', () => {
  const text = fs.readFileSync(SKILL_PATH, 'utf8');
  const parsed = validator.parseFrontmatter(text, SKILL_PATH);

  it('has a parseable frontmatter block', () => {
    expect(parsed.fm).not.toBeNull();
    expect(parsed.issues).toEqual([]);
  });

  it('declares the expected name and a real description', () => {
    expect(parsed.fm.name).toBe(SKILL_NAME);
    expect(typeof parsed.fm.description).toBe('string');
    expect(parsed.fm.description.length).toBeGreaterThan(20);
  });

  it('is manual-only: disable-model-invocation is true', () => {
    expect(String(parsed.fm['disable-model-invocation']).toLowerCase()).toBe('true');
  });

  it('is user-invocable', () => {
    expect(String(parsed.fm['user-invocable']).toLowerCase()).toBe('true');
  });

  it('declares invocation: user', () => {
    expect(String(parsed.fm.invocation).toLowerCase()).toBe('user');
  });

  it('effort is high', () => {
    expect(parsed.fm.effort).toBe('high');
  });
});

describe('storyline-narrative-officer skill — structure + safety', () => {
  const text = fs.readFileSync(SKILL_PATH, 'utf8');
  const parsed = validator.parseFrontmatter(text, SKILL_PATH);

  it('passes the shared structure check (H1, fences, EOF newline)', () => {
    const res = validator.checkStructure(text, parsed.bodyStart || 0, SKILL_NAME, SKILL_PATH);
    expect(res.issues).toEqual([]);
  });

  it('passes the shared safety check (no secret shapes, handles, URLs, scrape)', () => {
    const res = validator.checkSafety(text, SKILL_PATH);
    expect(res.issues).toEqual([]);
  });
});

describe('storyline-narrative-officer skill — required content', () => {
  const text = fs.readFileSync(SKILL_PATH, 'utf8');
  // Normalize away Markdown emphasis (`*`) and code (`` ` ``) markers so a
  // phrase split by bold formatting still matches as a contiguous substring.
  const lower = text.replace(/[*`]/g, '').toLowerCase();

  it('states it is not a production feature', () => {
    expect(lower).toContain('not a production feature');
    expect(lower).toContain('no production use');
  });

  it('states it is manual-only and dev/design-only', () => {
    expect(lower).toContain('manual-only');
    expect(lower).toContain('dev/design-only');
  });

  it('states it does not call AI APIs', () => {
    expect(lower).toContain('does not call ai apis');
    expect(lower).toContain('anthropic');
    expect(lower).toContain('xai');
    expect(lower).toContain('openai');
  });

  it('states it does not run app tests unless explicitly asked', () => {
    expect(lower).toContain('does not run the app test suite unless the operator explicitly asks');
  });

  it('states it does not write Supabase data', () => {
    expect(lower).toContain('does not write supabase data');
    expect(lower).toContain('no supabase writes');
  });

  it('states it does not use the service-role key', () => {
    expect(lower).toContain('service-role');
    expect(lower).toContain('does not use the service-role key');
  });

  it('states it never direct-inserts into public.arguments', () => {
    expect(lower).toContain('direct insert');
    expect(lower).toContain('public.arguments');
  });

  it('states it does not send email', () => {
    expect(lower).toContain('does not send email');
  });

  it('writes no secrets — the SKILL.md itself carries no secret-shape strings', () => {
    // Defense in depth — checkSafety already covers this; assert explicitly.
    expect(text).not.toMatch(/sk-ant-[A-Za-z0-9_-]{12,}/);
    expect(text).not.toMatch(/xai-[A-Za-z0-9_-]{12,}/);
    expect(text).not.toMatch(/sb_secret_[A-Za-z0-9_-]{8,}/);
    expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/);
  });

  it('enforces "do not call it a game in UI"', () => {
    expect(lower).toContain('do not call it a game in ui');
  });

  it('enforces "prefer Argument over Debate in UI"', () => {
    expect(lower).toContain('prefer argument over debate in ui');
  });

  it('contains the issue-deduping requirement', () => {
    expect(lower).toContain('issue-deduping');
    expect(lower).toContain('dedupe');
    expect(lower).toContain('inspect the existing roadmap issues');
  });

  it('describes the storyboard deliverables', () => {
    expect(lower).toContain('storyboard');
    expect(lower).toContain('interaction taxonomy');
    expect(lower).toContain('terminology');
  });

  it('describes the missing-capability mapping', () => {
    expect(lower).toContain('missing-capability mapping');
  });

  it('separates story need / current support / missing support / issue target / acceptance criteria', () => {
    expect(lower).toContain('story need');
    expect(lower).toContain('current app support');
    expect(lower).toContain('missing app support');
    expect(lower).toContain('issue target');
    expect(lower).toContain('acceptance criteria');
  });

  it('describes coordination with design, issue, and implementation agents', () => {
    expect(lower).toContain('design agent');
    expect(lower).toContain('issue agent');
    expect(lower).toContain('implementation agent');
  });
});
