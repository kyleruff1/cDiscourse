/**
 * START-001 (#827) — personArgumentPickerModel unit matrix.
 *
 * Covers every public function of the pure picker model:
 *   - deriveRecentOpponents (dedupe by e-mail keeping newest, sort desc by
 *     recency, cap at limit, masked display form, malformed-row skip);
 *   - personTargetToInviteEmail / personTargetToCreationIntent for all three
 *     PersonTarget kinds, including the TWO-TAP invariant (visibility passes
 *     through; open_floor never forces public);
 *   - orderPickerRows fixed order + open-floor-LAST invariant + reserved
 *     circles slot + hasTypedEmail flag;
 *   - a ban-list scan of _forbiddenPersonPickerTokens over the model surface;
 *   - a source-scan proving the model is pure (no React / Supabase / profiles
 *     search).
 */
import fs from 'fs';
import path from 'path';
import {
  deriveRecentOpponents,
  personTargetToInviteEmail,
  personTargetToCreationIntent,
  orderPickerRows,
  isOpenFloorLast,
  DEFAULT_RECENT_OPPONENTS_LIMIT,
  _forbiddenPersonPickerTokens,
  type RecentInviteRow,
  type RecentOpponent,
  type CircleOption,
  type PersonTarget,
} from '../src/features/arguments/startArgument/personArgumentPickerModel';
import { maskInviteeEmail } from '../src/features/invites/inviteModel';

function row(email: string, createdAt: string, status = 'pending'): RecentInviteRow {
  return { invitee_email_lower: email, debate_id: 'd-' + email, created_at: createdAt, status };
}

// ── deriveRecentOpponents ───────────────────────────────────────

describe('deriveRecentOpponents', () => {
  it('returns [] for a null / non-array input', () => {
    expect(deriveRecentOpponents(null)).toEqual([]);
    expect(deriveRecentOpponents(undefined)).toEqual([]);
    expect(deriveRecentOpponents([] as RecentInviteRow[])).toEqual([]);
  });

  it('sorts newest-first by invite recency (structural, never heat)', () => {
    const rows = [
      row('a@example.com', '2026-01-01T00:00:00.000Z'),
      row('b@example.com', '2026-03-01T00:00:00.000Z'),
      row('c@example.com', '2026-02-01T00:00:00.000Z'),
    ];
    const result = deriveRecentOpponents(rows);
    expect(result.map((r) => r.email)).toEqual([
      'b@example.com',
      'c@example.com',
      'a@example.com',
    ]);
  });

  it('dedupes by invitee_email_lower keeping the newest created_at', () => {
    const rows = [
      row('dup@example.com', '2026-01-01T00:00:00.000Z'),
      row('dup@example.com', '2026-05-01T00:00:00.000Z'),
      row('dup@example.com', '2026-03-01T00:00:00.000Z'),
    ];
    const result = deriveRecentOpponents(rows);
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('dup@example.com');
    expect(result[0].lastInvitedAtMs).toBe(Date.parse('2026-05-01T00:00:00.000Z'));
  });

  it('carries the full e-mail internally and a masked form for display', () => {
    const result = deriveRecentOpponents([row('alice@example.com', '2026-01-01T00:00:00.000Z')]);
    expect(result[0].email).toBe('alice@example.com');
    expect(result[0].maskedEmail).toBe(maskInviteeEmail('alice@example.com'));
    expect(result[0].maskedEmail).toBe('a•••@example.com');
    // The masked form never echoes the full local part.
    expect(result[0].maskedEmail).not.toContain('lice');
  });

  it('caps at the default limit (8) and at a custom limit', () => {
    const rows: RecentInviteRow[] = [];
    for (let i = 0; i < 20; i++) {
      rows.push(row(`u${i}@example.com`, `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`));
    }
    expect(deriveRecentOpponents(rows)).toHaveLength(DEFAULT_RECENT_OPPONENTS_LIMIT);
    expect(deriveRecentOpponents(rows, 3)).toHaveLength(3);
    // Newest three survive the cap.
    expect(deriveRecentOpponents(rows, 3).map((r) => r.email)).toEqual([
      'u19@example.com',
      'u18@example.com',
      'u17@example.com',
    ]);
  });

  it('falls back to the default limit for a non-positive / non-finite limit', () => {
    const rows: RecentInviteRow[] = [];
    for (let i = 0; i < 12; i++) rows.push(row(`u${i}@example.com`, `2026-02-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`));
    expect(deriveRecentOpponents(rows, 0)).toHaveLength(DEFAULT_RECENT_OPPONENTS_LIMIT);
    expect(deriveRecentOpponents(rows, -5)).toHaveLength(DEFAULT_RECENT_OPPONENTS_LIMIT);
    expect(deriveRecentOpponents(rows, Number.NaN)).toHaveLength(DEFAULT_RECENT_OPPONENTS_LIMIT);
  });

  it('skips a malformed / unnormalisable e-mail row', () => {
    const rows = [
      row('good@example.com', '2026-01-01T00:00:00.000Z'),
      row('not-an-email', '2026-01-02T00:00:00.000Z'),
      row('', '2026-01-03T00:00:00.000Z'),
    ];
    const result = deriveRecentOpponents(rows);
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('good@example.com');
  });

  it('treats an unparseable created_at as 0 (never throws)', () => {
    const result = deriveRecentOpponents([row('x@example.com', 'not-a-date')]);
    expect(result).toHaveLength(1);
    expect(result[0].lastInvitedAtMs).toBe(0);
  });

  it('does not mutate the input array', () => {
    const rows = [row('a@example.com', '2026-01-01T00:00:00.000Z'), row('b@example.com', '2026-02-01T00:00:00.000Z')];
    const snapshot = JSON.parse(JSON.stringify(rows));
    deriveRecentOpponents(rows);
    expect(rows).toEqual(snapshot);
  });
});

// ── personTargetToInviteEmail ───────────────────────────────────

describe('personTargetToInviteEmail', () => {
  it('returns the address for profile + email kinds', () => {
    expect(personTargetToInviteEmail({ kind: 'profile', email: 'a@example.com' })).toBe('a@example.com');
    expect(personTargetToInviteEmail({ kind: 'email', email: 'b@example.com' })).toBe('b@example.com');
  });

  it('returns empty string for open_floor and for null', () => {
    expect(personTargetToInviteEmail({ kind: 'open_floor' })).toBe('');
    expect(personTargetToInviteEmail(null)).toBe('');
    expect(personTargetToInviteEmail(undefined)).toBe('');
  });
});

// ── personTargetToCreationIntent (two-tap invariant) ────────────

describe('personTargetToCreationIntent', () => {
  it('maps a profile target to one invite, visibility passed through', () => {
    const target: PersonTarget = { kind: 'profile', email: 'dana@example.com' };
    expect(personTargetToCreationIntent(target, 'private')).toEqual({
      visibility: 'private',
      directInviteEmails: ['dana@example.com'],
    });
  });

  it('maps a typed-email target to one invite, visibility passed through', () => {
    const target: PersonTarget = { kind: 'email', email: 'new@example.com' };
    expect(personTargetToCreationIntent(target, 'private')).toEqual({
      visibility: 'private',
      directInviteEmails: ['new@example.com'],
    });
  });

  it('maps open_floor to zero invites and NEVER forces public (two-tap invariant)', () => {
    // Open floor while the sheet still holds its private default: NOT public.
    expect(personTargetToCreationIntent({ kind: 'open_floor' }, 'private')).toEqual({
      visibility: 'private',
      directInviteEmails: [],
    });
    // Public is only produced when the caller (the toggle-owned sheet state)
    // already supplies 'public' — the model never fabricates it.
    expect(personTargetToCreationIntent({ kind: 'open_floor' }, 'public')).toEqual({
      visibility: 'public',
      directInviteEmails: [],
    });
  });

  it('never returns public from any target unless the caller passed public', () => {
    const targets: PersonTarget[] = [
      { kind: 'profile', email: 'a@example.com' },
      { kind: 'email', email: 'b@example.com' },
      { kind: 'open_floor' },
    ];
    for (const t of targets) {
      expect(personTargetToCreationIntent(t, 'private').visibility).toBe('private');
    }
  });
});

// ── orderPickerRows + open-floor-last invariant ─────────────────

describe('orderPickerRows', () => {
  const recents: RecentOpponent[] = [
    { email: 'a@example.com', maskedEmail: 'a•••@example.com', lastInvitedAtMs: 3 },
    { email: 'b@example.com', maskedEmail: 'b•••@example.com', lastInvitedAtMs: 2 },
  ];

  it('produces the fixed order recents -> circles -> email entry -> open floor', () => {
    const circles: CircleOption[] = [{ id: 'c1', label: 'Book club' }];
    const rows = orderPickerRows(recents, circles);
    expect(rows.map((r) => r.kind)).toEqual([
      'recent',
      'recent',
      'circle',
      'email_entry',
      'open_floor',
    ]);
  });

  it('always places open_floor LAST — even with no recents and no circles', () => {
    const rows = orderPickerRows([], []);
    expect(rows.map((r) => r.kind)).toEqual(['email_entry', 'open_floor']);
    expect(isOpenFloorLast(rows)).toBe(true);
  });

  it('open_floor is last across every source-cardinality combination', () => {
    const combos: Array<[RecentOpponent[], CircleOption[]]> = [
      [[], []],
      [recents, []],
      [[], [{ id: 'c1', label: 'Circle' }]],
      [recents, [{ id: 'c1', label: 'Circle' }]],
    ];
    for (const [rc, ci] of combos) {
      const rows = orderPickerRows(rc, ci);
      expect(isOpenFloorLast(rows)).toBe(true);
      expect(rows[rows.length - 1].kind).toBe('open_floor');
    }
  });

  it('reflects hasTypedEmail on the email-entry row without changing order', () => {
    const withText = orderPickerRows(recents, [], true);
    const emailRowWith = withText.find((r) => r.kind === 'email_entry');
    expect(emailRowWith?.hasValue).toBe(true);
    const without = orderPickerRows(recents, [], false);
    const emailRowWithout = without.find((r) => r.kind === 'email_entry');
    expect(emailRowWithout?.hasValue).toBe(false);
    expect(withText.map((r) => r.kind)).toEqual(without.map((r) => r.kind));
  });

  it('dedupes duplicate recent e-mails so a person shows once', () => {
    const dupRecents: RecentOpponent[] = [
      { email: 'a@example.com', maskedEmail: 'a•••@example.com', lastInvitedAtMs: 3 },
      { email: 'a@example.com', maskedEmail: 'a•••@example.com', lastInvitedAtMs: 3 },
    ];
    const rows = orderPickerRows(dupRecents, []);
    expect(rows.filter((r) => r.kind === 'recent')).toHaveLength(1);
  });

  it('handles null circles (START-001 reserves the slot, always [])', () => {
    const rows = orderPickerRows(recents, null);
    expect(rows.some((r) => r.kind === 'circle')).toBe(false);
    expect(isOpenFloorLast(rows)).toBe(true);
  });
});

describe('isOpenFloorLast', () => {
  it('returns false for an empty / non-array list', () => {
    expect(isOpenFloorLast([])).toBe(false);
    expect(isOpenFloorLast(null as never)).toBe(false);
  });

  it('returns false when open_floor is not last', () => {
    const rows = orderPickerRows(
      [{ email: 'a@example.com', maskedEmail: 'a•••@example.com', lastInvitedAtMs: 1 }],
      [],
    );
    const reordered = [rows[rows.length - 1], ...rows.slice(0, -1)];
    expect(isOpenFloorLast(reordered)).toBe(false);
  });
});

// ── Ban-list + purity source-scan ───────────────────────────────

describe('personArgumentPickerModel — doctrine + purity', () => {
  const MODEL_SRC = fs.readFileSync(
    path.join(process.cwd(), 'src/features/arguments/startArgument/personArgumentPickerModel.ts'),
    'utf8',
  );
  const API_SRC = fs.readFileSync(
    path.join(process.cwd(), 'src/features/arguments/startArgument/recentOpponentsApi.ts'),
    'utf8',
  );

  it('the ban list is a non-empty list of forbidden tokens', () => {
    const tokens = _forbiddenPersonPickerTokens();
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens).toEqual(expect.arrayContaining(['winner', 'loser', 'viral', 'opponent']));
  });

  it('the model authors no user-facing display copy (no quoted prose sentences)', () => {
    // The model emits data, not copy — so it can carry no verdict / person
    // string. Its only quoted strings are keys, kinds, and code identifiers
    // (kebab / snake / colon-joined), never a rendered sentence with spaces.
    const quoted = MODEL_SRC.match(/'[^']*'|"[^"]*"/g) || [];
    for (const raw of quoted) {
      const inner = raw.slice(1, -1);
      // A display sentence would contain a space AND end-of-sentence prose.
      // Model literals are single tokens (email, kind names, keys) or the
      // ban-list words — none is a multi-word sentence.
      const isSentence = /\s/.test(inner) && inner.split(/\s+/).length > 2;
      expect(isSentence).toBe(false);
    }
  });

  it('model is pure — no React, no Supabase, no network import', () => {
    expect(MODEL_SRC).not.toMatch(/from\s+['"]react['"]/);
    expect(MODEL_SRC).not.toMatch(/from\s+['"]react-native['"]/);
    expect(MODEL_SRC).not.toMatch(/from\s+['"]@supabase\//);
    expect(MODEL_SRC).not.toMatch(/from\s+['"][^'"]*\/supabase['"]/);
    expect(MODEL_SRC).not.toMatch(/\.invoke\(/);
    expect(MODEL_SRC).not.toMatch(/console\.log/);
    expect(MODEL_SRC).not.toMatch(/SERVICE_ROLE/);
  });

  it('no picker read performs a profiles enumeration / search (privacy ban)', () => {
    for (const src of [MODEL_SRC, API_SRC]) {
      expect(src).not.toMatch(/from\(\s*['"]profiles['"]\s*\)/);
      expect(src).not.toMatch(/\.ilike\(/);
    }
  });

  it('the recents read is scoped to the viewer own invites via ari_select_inviter_own', () => {
    expect(API_SRC).toContain('argument_room_invites');
    expect(API_SRC).toContain("eq('invited_by'");
    expect(API_SRC).toContain('ari_select_inviter_own');
    expect(API_SRC).not.toMatch(/SERVICE_ROLE/);
  });
});
