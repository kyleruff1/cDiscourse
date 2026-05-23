/**
 * QOL-041 — Doctrine ban-list scan + source-purity guard.
 *
 * The design §10 final test plan item: scan EVERY QOL-041 user-facing
 * string for the banned tokens (winner / loser / truth / verdict /
 * correct / false / liar / dishonest / bad faith / game) and the
 * source files for service-role / direct-arguments-insert / AI-import
 * violations.
 *
 * Mirrors the precedent doctrine safety suites
 * (`oneBoxCopyBanList.test.ts`, `qol037` etc.).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  ACCEPTANCE_LEVEL_COPY,
  ALL_ACCEPTANCE_LEVELS,
  _forbiddenAcceptanceGradientTokens,
} from '../src/features/concessions/acceptanceGradient';
import {
  ACTIVE_DISAGREEMENT_LABEL,
  ALL_ACTIVE_DISAGREEMENT_KINDS,
} from '../src/features/concessions/activeDisagreement';
import { CONCESSION_LIST_SECTION_COPY } from '../src/features/arguments/oneBox/schemas/ConcessionListSection';
import { RESPOND_TO_CONCESSION_SCHEMA_COPY } from '../src/features/arguments/oneBox/schemas/RespondToConcessionSchema';
import { FIST_BUMP_COPY } from '../src/features/concessions/FistBumpReaction';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

// ── Collect every QOL-041 user-facing string ──────────────────

function collectQol041Strings(): Array<{ where: string; value: string }> {
  const out: Array<{ where: string; value: string }> = [];

  // 1. Acceptance gradient — labels + helpers.
  for (const level of ALL_ACCEPTANCE_LEVELS) {
    out.push({
      where: `ACCEPTANCE_LEVEL_COPY.${level}.label`,
      value: ACCEPTANCE_LEVEL_COPY[level].label,
    });
    out.push({
      where: `ACCEPTANCE_LEVEL_COPY.${level}.helper`,
      value: ACCEPTANCE_LEVEL_COPY[level].helper,
    });
  }

  // 2. Active disagreement — room-status labels.
  for (const kind of ALL_ACTIVE_DISAGREEMENT_KINDS) {
    out.push({
      where: `ACTIVE_DISAGREEMENT_LABEL.${kind}`,
      value: ACTIVE_DISAGREEMENT_LABEL[kind],
    });
  }

  // 3. Concession list section — header / helper / button copy.
  // All entries are plain strings (no parameterised templates).
  const sectionEntries = Object.entries(CONCESSION_LIST_SECTION_COPY) as Array<
    [string, string]
  >;
  for (const [key, value] of sectionEntries) {
    out.push({ where: `CONCESSION_LIST_SECTION_COPY.${key}`, value });
  }

  // 4. Respond-to-concession schema — intro / prompts / footer / etc.
  // `introTemplate` is a function — call it with a representative
  // count so the produced string can be scanned. Every other key is a
  // plain string.
  const schemaEntries = Object.entries(RESPOND_TO_CONCESSION_SCHEMA_COPY) as Array<
    [string, string | ((n: number) => string)]
  >;
  for (const [key, value] of schemaEntries) {
    const v = typeof value === 'function' ? value(1) : value;
    out.push({ where: `RESPOND_TO_CONCESSION_SCHEMA_COPY.${key}`, value: v });
  }

  // 5. Fist-bump copy. `countA11y` is a function — call it with a
  // representative count.
  const fistEntries = Object.entries(FIST_BUMP_COPY) as Array<
    [string, string | ((n: number) => string)]
  >;
  for (const [key, value] of fistEntries) {
    const v = typeof value === 'function' ? value(3) : value;
    out.push({ where: `FIST_BUMP_COPY.${key}`, value: v });
  }

  return out;
}

const PRODUCED = collectQol041Strings();
const BANNED = _forbiddenAcceptanceGradientTokens();

const WORD_BOUNDARY_TOKENS = new Set([
  'true',
  'false',
  'won',
  'lost',
  'right',
  'wrong',
  'correct',
  'incorrect',
  'proof',
  'proven',
  'shares',
  'likes',
]);

function hitsBanned(s: string, token: string): boolean {
  const lower = s.toLowerCase();
  const t = token.toLowerCase();
  if (WORD_BOUNDARY_TOKENS.has(t)) {
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    return re.test(lower);
  }
  return lower.includes(t);
}

// ── 1. The ban-list scan ──────────────────────────────────────

describe('QOL-041 — doctrine ban-list scan over EVERY user-facing string', () => {
  it('the ban-list is non-empty and lowercase', () => {
    expect(BANNED.length).toBeGreaterThan(0);
    for (const t of BANNED) expect(t).toBe(t.toLowerCase());
  });

  it('collects every QOL-041 user-facing string (multiple modules)', () => {
    // 5 acceptance labels + 5 helpers + 4 active-disagreement labels +
    // ConcessionListSection (8 keys) + RespondToConcessionSchema (7
    // keys) + FistBumpReaction (9 keys) = 38.
    expect(PRODUCED.length).toBe(5 + 5 + 4 + 8 + 7 + 9);
  });

  it('no produced string contains a forbidden verdict / amplification token', () => {
    for (const { where, value } of PRODUCED) {
      for (const token of BANNED) {
        expect({ where, value, hit: hitsBanned(value, token) ? token : null }).toEqual({
          where,
          value,
          hit: null,
        });
      }
    }
  });

  it('no produced string looks like an internal code', () => {
    for (const { where, value } of PRODUCED) {
      expect({ where, leaks: looksLikeInternalCode(value) }).toEqual({
        where,
        leaks: false,
      });
    }
  });

  it('no produced string leaks a raw snake_case QOL-041 enum id', () => {
    // The compound (snake_case) internal enum ids — `agree_with_caveat`,
    // `disagree_framing`, `disagree_context`, `disagree_fact`,
    // `fist_bump` — must not appear verbatim in any label / helper /
    // prose. The single-word ids (`agree`, `fact`, `framing`,
    // `context`, `none`) DO appear legitimately in user-facing strings
    // — they are plain English words (e.g. "Active disagreement:
    // fact." — design §7.2) — so they are NOT scanned here. A snake
    // contains an underscore — that is the test.
    const snakeIds = [
      ...ALL_ACCEPTANCE_LEVELS,
      ...ALL_ACTIVE_DISAGREEMENT_KINDS,
      'fist_bump',
    ].filter((id) => id.includes('_'));
    expect(snakeIds.length).toBeGreaterThan(0);
    for (const { where, value } of PRODUCED) {
      for (const id of snakeIds) {
        expect({ where, id, leaks: value.includes(id) }).toEqual({
          where,
          id,
          leaks: false,
        });
      }
    }
  });
});

// ── 2. Terminology preference — argument > debate ─────────────

describe('QOL-041 — terminology preference (argument > debate)', () => {
  it('every produced string preferring "argument" over "debate" passes', () => {
    // Per QOL-035 + the design's own copy ("conceded points",
    // "concession set", "respond to evidence") — QOL-041 copy uses
    // "point" / "argument" / "response" vocabulary, never "debate".
    for (const { where, value } of PRODUCED) {
      const lower = value.toLowerCase();
      expect({ where, leaks: lower.includes('debate') }).toEqual({
        where,
        leaks: false,
      });
    }
  });

  it('the word "moderator" does not appear in any QOL-041 copy', () => {
    // The repo-wide terminology audit prefers "observer" / "admin"
    // over "moderator" in user-facing copy.
    for (const { where, value } of PRODUCED) {
      expect({ where, leaks: value.toLowerCase().includes('moderator') }).toEqual({
        where,
        leaks: false,
      });
    }
  });
});

// ── 3. Source-purity scan — the pure models import nothing bad ──

const repoRoot = process.cwd();
const PURE_MODEL_FILES = [
  'src/features/concessions/acceptanceGradient.ts',
  'src/features/concessions/concessionListModel.ts',
  'src/features/concessions/respondToConcessionModel.ts',
  'src/features/concessions/activeDisagreement.ts',
  'src/features/concessions/moveReactionModel.ts',
  'src/features/concessions/index.ts',
];

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('QOL-041 — pure-model source purity scan', () => {
  const pureModels = PURE_MODEL_FILES.map((rel) => ({
    name: rel,
    src: stripComments(fs.readFileSync(path.join(repoRoot, rel), 'utf8')),
  }));

  it('no pure model imports Supabase', () => {
    for (const { name, src } of pureModels) {
      expect({ name, hit: /from ['"][^'"]*supabase/.test(src) }).toEqual({
        name,
        hit: false,
      });
    }
  });

  it('no pure model imports React or React Native', () => {
    for (const { name, src } of pureModels) {
      expect({ name, hit: /from ['"]react(-native)?['"]/.test(src) }).toEqual({
        name,
        hit: false,
      });
    }
  });

  it('no pure model performs a network call', () => {
    for (const { name, src } of pureModels) {
      expect({ name, hit: /\bfetch\(/.test(src) }).toEqual({ name, hit: false });
      expect({ name, hit: /\bXMLHttpRequest\b/.test(src) }).toEqual({ name, hit: false });
    }
  });

  it('no pure model imports an AI provider', () => {
    for (const { name, src } of pureModels) {
      expect({ name, hit: /anthropic|openai|x\.ai/i.test(src) }).toEqual({
        name,
        hit: false,
      });
    }
  });

  it('no pure model reads Date.now() (deterministic — design §11)', () => {
    for (const { name, src } of pureModels) {
      expect({ name, hit: /Date\.now\(\)/.test(src) }).toEqual({ name, hit: false });
    }
  });

  it('no pure model uses Math.random() (deterministic)', () => {
    for (const { name, src } of pureModels) {
      expect({ name, hit: /Math\.random\(\)/.test(src) }).toEqual({ name, hit: false });
    }
  });
});

// ── 4. Client-side direct-insert guard ────────────────────────

const CLIENT_FILES_TO_SCAN = [
  'src/features/concessions/acceptanceGradient.ts',
  'src/features/concessions/concessionListModel.ts',
  'src/features/concessions/respondToConcessionModel.ts',
  'src/features/concessions/activeDisagreement.ts',
  'src/features/concessions/moveReactionModel.ts',
  'src/features/concessions/FistBumpReaction.tsx',
  'src/features/arguments/oneBox/schemas/ConcessionListSection.tsx',
  'src/features/arguments/oneBox/schemas/RespondToConcessionSchema.tsx',
  'src/features/arguments/oneBox/schemas/AcceptanceGradientControl.tsx',
];

describe('QOL-041 — client-side direct-write guard', () => {
  const clientFiles = CLIENT_FILES_TO_SCAN.map((rel) => ({
    name: rel,
    code: stripComments(fs.readFileSync(path.join(repoRoot, rel), 'utf8')),
  }));

  it('no QOL-041 client file inserts into public.arguments directly', () => {
    for (const { name, code } of clientFiles) {
      expect({
        name,
        hit: /from\(['"]arguments['"]\)\s*\.\s*insert\(/.test(code),
      }).toEqual({ name, hit: false });
    }
  });

  it('no QOL-041 client file writes to concession_items / concession_acceptances directly', () => {
    for (const { name, code } of clientFiles) {
      expect({
        name,
        hit: /from\(['"]concession_items['"]\)\s*\.\s*(insert|update|delete)\(/.test(code),
      }).toEqual({ name, hit: false });
      expect({
        name,
        hit: /from\(['"]concession_acceptances['"]\)\s*\.\s*(insert|update|delete)\(/.test(code),
      }).toEqual({ name, hit: false });
    }
  });

  it('no QOL-041 client file writes to move_reactions directly (must go through react-to-move)', () => {
    for (const { name, code } of clientFiles) {
      expect({
        name,
        hit: /from\(['"]move_reactions['"]\)\s*\.\s*(insert|update|delete)\(/.test(code),
      }).toEqual({ name, hit: false });
    }
  });

  it('no QOL-041 client file imports SERVICE_ROLE or service-role helpers', () => {
    for (const { name, code } of clientFiles) {
      expect({ name, hit: /SERVICE_ROLE|service_role/.test(code) }).toEqual({
        name,
        hit: false,
      });
      expect({ name, hit: /createServiceClient/.test(code) }).toEqual({
        name,
        hit: false,
      });
    }
  });

  it('no QOL-041 client file imports an AI / external-provider SDK', () => {
    for (const { name, code } of clientFiles) {
      expect({ name, hit: /anthropic|openai|x\.ai/i.test(code) }).toEqual({
        name,
        hit: false,
      });
    }
  });
});

// ── 5. Migration ↔ Edge ↔ client vocabulary parity (sanity) ───

describe('QOL-041 — single source of truth vocabulary parity', () => {
  it('every acceptance level appears in the migration CHECK', () => {
    const migrationSrc = fs.readFileSync(
      path.join(
        repoRoot,
        'supabase/migrations/20260522000012_qol_041_concession_acceptance.sql',
      ),
      'utf8',
    );
    for (const level of ALL_ACCEPTANCE_LEVELS) {
      expect(migrationSrc).toContain(`'${level}'`);
    }
  });

  it('every acceptance level appears in the Edge Function validation schema', () => {
    const schemaSrc = fs.readFileSync(
      path.join(repoRoot, 'supabase/functions/_shared/validationSchemas.ts'),
      'utf8',
    );
    for (const level of ALL_ACCEPTANCE_LEVELS) {
      expect(schemaSrc).toContain(`'${level}'`);
    }
  });

  it('the move_reactions kind enum is a single value across migration + edge + client model', () => {
    const migrationSrc = fs.readFileSync(
      path.join(
        repoRoot,
        'supabase/migrations/20260522000012_qol_041_concession_acceptance.sql',
      ),
      'utf8',
    );
    const edgeSrc = fs.readFileSync(
      path.join(repoRoot, 'supabase/functions/react-to-move/index.ts'),
      'utf8',
    );
    // Migration CHECK has 'fist_bump' only.
    expect(migrationSrc).toMatch(/check \(kind in \('fist_bump'\)\)/);
    // Edge Function ALLOWED_KINDS set contains only 'fist_bump'.
    expect(edgeSrc).toContain("ALLOWED_KINDS = new Set<string>(['fist_bump'])");
  });
});
