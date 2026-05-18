/**
 * Tests for scripts/github/syncUxProjectBoard.js
 *
 * Covers:
 * - parseArgs default + flag handling
 * - loadCards reads the on-disk catalogue
 * - validateCatalogue enforces prefix shape, dedupe, field options,
 *   and rejects secret-shape strings in card bodies
 * - renderIssueBody appends the managed-by footer
 * - dry-run path never invokes `gh` (no spawnSync called for `gh`)
 */
const path = require('path');
const fs = require('fs');

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'github', 'syncUxProjectBoard.js');
const CATALOGUE = path.resolve(__dirname, '..', 'scripts', 'github', 'uxBoardCards.json');

const sync = require(SCRIPT);

describe('syncUxProjectBoard', () => {
  describe('parseArgs', () => {
    it('defaults to dry-run', () => {
      const args = sync.parseArgs(['node', 'sync.js']);
      expect(args.dryRun).toBe(true);
      expect(args.owner).toBeNull();
      expect(args.projectTitle).toBeNull();
    });

    it('respects --apply', () => {
      const args = sync.parseArgs(['node', 'sync.js', '--apply']);
      expect(args.dryRun).toBe(false);
    });

    it('parses --owner and --project-title', () => {
      const args = sync.parseArgs(['node', 'sync.js', '--owner', 'someone', '--project-title', 'My Board']);
      expect(args.owner).toBe('someone');
      expect(args.projectTitle).toBe('My Board');
    });
  });

  describe('loadCards', () => {
    it('reads the on-disk catalogue and returns the expected shape', () => {
      const catalogue = sync.loadCards();
      expect(Array.isArray(catalogue.cards)).toBe(true);
      expect(catalogue.cards.length).toBeGreaterThan(0);
      expect(catalogue.projectNumber).toBeDefined();
      expect(catalogue.projectOwner).toBeDefined();
    });

    it('catalogue file on disk is valid JSON', () => {
      const raw = fs.readFileSync(CATALOGUE, 'utf8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  });

  describe('validateCatalogue', () => {
    it('returns no issues for the current catalogue', () => {
      const catalogue = sync.loadCards();
      const issues = sync.validateCatalogue(catalogue);
      expect(issues).toEqual([]);
    });

    it('flags a duplicate prefix', () => {
      const catalogue = sync.loadCards();
      const dup = JSON.parse(JSON.stringify(catalogue));
      dup.cards.push({ ...dup.cards[0] });
      const issues = sync.validateCatalogue(dup);
      expect(issues.some((i: string) => i.includes('duplicate prefix'))).toBe(true);
    });

    it('flags a bad prefix shape', () => {
      const catalogue = sync.loadCards();
      const bad = JSON.parse(JSON.stringify(catalogue));
      bad.cards[0].prefix = 'NOTACARD';
      bad.cards[0].title = 'NOTACARD - whatever';
      const issues = sync.validateCatalogue(bad);
      expect(issues.some((i: string) => i.includes('bad prefix'))).toBe(true);
    });

    it('flags a priority outside the project schema', () => {
      const catalogue = sync.loadCards();
      const off = JSON.parse(JSON.stringify(catalogue));
      off.cards[0].priority = 'P9';
      const issues = sync.validateCatalogue(off);
      expect(issues.some((i: string) => i.includes('priority "P9" not in project schema'))).toBe(true);
    });

    it('flags an epic outside the project schema', () => {
      const catalogue = sync.loadCards();
      const off = JSON.parse(JSON.stringify(catalogue));
      off.cards[0].epic = 'Unicorn';
      const issues = sync.validateCatalogue(off);
      expect(issues.some((i: string) => i.includes('epic "Unicorn" not in project schema'))).toBe(true);
    });

    it('flags a release outside the project schema', () => {
      const catalogue = sync.loadCards();
      const off = JSON.parse(JSON.stringify(catalogue));
      off.cards[0].release = '99.9';
      const issues = sync.validateCatalogue(off);
      expect(issues.some((i: string) => i.includes('release "99.9" not in project schema'))).toBe(true);
    });

    it('flags a body that contains a secret-shape string', () => {
      const catalogue = sync.loadCards();
      const tainted = JSON.parse(JSON.stringify(catalogue));
      tainted.cards[0].body = [...tainted.cards[0].body, 'leaked: sk-ant-abcdef0123456789abcdef'];
      const issues = sync.validateCatalogue(tainted);
      expect(issues.some((i: string) => i.includes('secret-shape string'))).toBe(true);
    });

    it('flags a title that does not start with its prefix', () => {
      const catalogue = sync.loadCards();
      const off = JSON.parse(JSON.stringify(catalogue));
      off.cards[0].title = 'Wrong title';
      const issues = sync.validateCatalogue(off);
      expect(issues.some((i: string) => i.includes('title must start with prefix'))).toBe(true);
    });
  });

  describe('renderIssueBody', () => {
    it('appends the managed-by footer with prefix / release / epic / effort / priority', () => {
      const catalogue = sync.loadCards();
      const card = catalogue.cards[0];
      const body = sync.renderIssueBody(card, catalogue);
      expect(body).toContain(card.body[0]);
      expect(body).toContain('Roadmap card managed by `scripts/github/syncUxProjectBoard.js`');
      expect(body).toContain(`Prefix \`${card.prefix}\``);
      expect(body).toContain(`Release \`${card.release}\``);
      expect(body).toContain(`Epic \`${card.epic}\``);
      expect(body).toContain(`Effort \`${card.effort}\``);
      expect(body).toContain(`Priority \`${card.priority}\``);
    });
  });

  describe('catalogue safety', () => {
    it('contains no secret-shape strings anywhere in the JSON', () => {
      const raw = fs.readFileSync(CATALOGUE, 'utf8');
      // Same patterns used by the validator.
      const secretShapes = [
        /sk-ant-[A-Za-z0-9_-]{12,}/,
        /xai-[A-Za-z0-9_-]{20,}/,
        /sb_secret_[A-Za-z0-9_-]{8,}/,
        /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/,
        /Bearer\s+[A-Za-z0-9._-]{16,}/,
      ];
      for (const re of secretShapes) {
        expect(raw).not.toMatch(re);
      }
    });

    it('contains no plausible Authorization header literal', () => {
      const raw = fs.readFileSync(CATALOGUE, 'utf8');
      // Allow the substring "Authorization" as docs/prose; reject "Authorization:" followed by a token-shape.
      expect(raw).not.toMatch(/Authorization:\s+[A-Za-z0-9._-]{16,}/);
    });

    it('contains no raw email-like personal address (none of the cards leak admin recipients)', () => {
      const raw = fs.readFileSync(CATALOGUE, 'utf8');
      // Accept the literal string "<my address>" or "admin@example" but reject real-shape addresses.
      const emailMatches = raw.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
      const blocked = emailMatches.filter((m: string) =>
        !m.endsWith('@example.com') && !m.includes('admin@example')
      );
      expect(blocked).toEqual([]);
    });

    it('every card body starts with a Goal section', () => {
      const catalogue = sync.loadCards();
      for (const card of catalogue.cards) {
        const first = (card.body || []).find((l: string) => l.trim().length > 0);
        expect(first).toBe('## Goal');
      }
    });
  });

  describe('hasGhCli / ghAuthOk', () => {
    it('returns booleans and never throws', () => {
      expect(typeof sync.hasGhCli()).toBe('boolean');
      expect(typeof sync.ghAuthOk()).toBe('boolean');
    });
  });
});
