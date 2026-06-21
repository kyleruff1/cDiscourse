/**
 * AUTH-GOOGLE-SSO-004 (#747) — pure-TS twin unit tests.
 *
 * `coalesceProviderDisplayName` is the executable spec that the migration
 * `20260620000001_auth_google_oauth_display_name_coalesce.sql`'s
 * `handle_new_user()` mirrors. These tests cover every card-required case
 * (priority, normalization, fallbacks, cap, never-throw, never-empty) with no
 * Supabase / Docker. The cap-constant parity test scans the migration text so
 * the TS cap and the SQL `left(…, N)` can never drift apart.
 */
import {
  coalesceProviderDisplayName,
  DISPLAY_NAME_DB_CAP,
  GENERIC_DISPLAY_NAME_FALLBACK,
} from '../src/features/auth/coalesceProviderDisplayName';
import * as fs from 'fs';
import * as path from 'path';

describe('coalesceProviderDisplayName — priority', () => {
  it('uses full_name when only full_name is present (typical Google)', () => {
    expect(coalesceProviderDisplayName({ full_name: 'Jane Doe' }, 'jane@x.com')).toBe('Jane Doe');
  });

  it('uses name when only name is present (some Google configs)', () => {
    expect(coalesceProviderDisplayName({ name: 'Jane' }, 'jane@x.com')).toBe('Jane');
  });

  it('display_name wins over full_name and name (email/password path)', () => {
    expect(
      coalesceProviderDisplayName(
        { display_name: 'JD', full_name: 'Jane Doe', name: 'Jane' },
        'jane@x.com',
      ),
    ).toBe('JD');
  });

  it('full_name wins over name when both present (no display_name)', () => {
    expect(coalesceProviderDisplayName({ full_name: 'Jane Doe', name: 'Jane' }, 'jane@x.com')).toBe(
      'Jane Doe',
    );
  });

  it('email local-part wins over the generic fallback', () => {
    expect(coalesceProviderDisplayName({}, 'jane.q@example.com')).toBe('jane.q');
  });
});

describe('coalesceProviderDisplayName — given/family concat', () => {
  it('combines given_name + family_name into "First Last"', () => {
    expect(
      coalesceProviderDisplayName({ given_name: 'Jane', family_name: 'Doe' }, 'jane@x.com'),
    ).toBe('Jane Doe');
  });

  it('given_name only → no stray trailing space', () => {
    expect(coalesceProviderDisplayName({ given_name: 'Jane' }, 'jane@x.com')).toBe('Jane');
  });

  it('family_name only → no stray leading space', () => {
    expect(coalesceProviderDisplayName({ family_name: 'Doe' }, 'jane@x.com')).toBe('Doe');
  });

  it('given/family yields to display_name/full_name/name when those exist', () => {
    expect(
      coalesceProviderDisplayName(
        { name: 'Preferred', given_name: 'Jane', family_name: 'Doe' },
        'jane@x.com',
      ),
    ).toBe('Preferred');
  });
});

describe('coalesceProviderDisplayName — fallbacks', () => {
  it('empty metadata + email → email local-part', () => {
    expect(coalesceProviderDisplayName({}, 'jane@example.com')).toBe('jane');
  });

  it('empty metadata + no email → generic fallback', () => {
    expect(coalesceProviderDisplayName({}, null)).toBe(GENERIC_DISPLAY_NAME_FALLBACK);
    expect(coalesceProviderDisplayName({}, null)).toBe('Member');
  });

  it('null metadata → email local-part when email present', () => {
    expect(coalesceProviderDisplayName(null, 'jane@x.com')).toBe('jane');
  });

  it('null metadata + null email → generic fallback', () => {
    expect(coalesceProviderDisplayName(null, null)).toBe('Member');
  });

  it('undefined metadata + undefined email → generic fallback (never throws)', () => {
    expect(() => coalesceProviderDisplayName(undefined, undefined)).not.toThrow();
    expect(coalesceProviderDisplayName(undefined, undefined)).toBe('Member');
  });

  it('empty-string email (the reachable email/password blank-name delta) → generic', () => {
    // Mirrors the SQL: '' display_name normalizes to NULL; split_part('', '@', 1)
    // is '' which nullif()s away → 'Member'. Documents the email-path delta.
    expect(coalesceProviderDisplayName({ display_name: '' }, '')).toBe('Member');
  });
});

describe('coalesceProviderDisplayName — normalization', () => {
  it('trims and collapses inner whitespace runs to a single space', () => {
    expect(coalesceProviderDisplayName({ full_name: '  Jane   Q.  Doe ' }, null)).toBe('Jane Q. Doe');
  });

  it('treats a whitespace-only candidate as absent and falls through', () => {
    expect(coalesceProviderDisplayName({ full_name: '   ', name: 'Jane' }, null)).toBe('Jane');
  });

  it('treats an empty-string display_name as absent (email/password empty case)', () => {
    expect(coalesceProviderDisplayName({ display_name: '', full_name: 'Jane Doe' }, null)).toBe(
      'Jane Doe',
    );
  });

  it('collapses whitespace inside a given+family concat', () => {
    expect(
      coalesceProviderDisplayName({ given_name: ' Jane ', family_name: '  Doe ' }, null),
    ).toBe('Jane Doe');
  });
});

describe('coalesceProviderDisplayName — cap + invariants', () => {
  it('caps an over-length name to exactly DISPLAY_NAME_DB_CAP characters', () => {
    const result = coalesceProviderDisplayName({ full_name: 'A'.repeat(90) }, null);
    expect(result.length).toBe(60);
    expect(result).toBe('A'.repeat(60));
  });

  it('never returns an empty string for any input', () => {
    const inputs: Array<[unknown, unknown]> = [
      [null, null],
      [undefined, undefined],
      [{}, ''],
      [{ full_name: '   ' }, '   '],
      [{ display_name: '' }, null],
    ];
    for (const [meta, email] of inputs) {
      const out = coalesceProviderDisplayName(meta as never, email as never);
      expect(out.length).toBeGreaterThan(0);
    }
  });

  it('DISPLAY_NAME_DB_CAP is 60 and matches the migration left(…, 60)', () => {
    expect(DISPLAY_NAME_DB_CAP).toBe(60);
    const migPath = path.join(
      process.cwd(),
      'supabase/migrations/20260620000001_auth_google_oauth_display_name_coalesce.sql',
    );
    const migSrc = fs.readFileSync(migPath, 'utf8');
    const sqlOnly = migSrc
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    expect(sqlOnly).toContain(`left(v_display_name, ${DISPLAY_NAME_DB_CAP})`);
  });
});

describe('coalesceProviderDisplayName — doctrine ban-list', () => {
  const BANNED = [
    'winner',
    'loser',
    'liar',
    'true',
    'false',
    'correct',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'stupid',
    'idiot',
  ];

  it('the generic fallback contains no ban-list token', () => {
    const lower = GENERIC_DISPLAY_NAME_FALLBACK.toLowerCase();
    for (const b of BANNED) {
      expect(lower).not.toContain(b);
    }
  });
});
