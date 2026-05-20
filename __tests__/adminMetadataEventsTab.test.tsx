/**
 * META-1C — AdminMetadataEventsTab component + view-model tests.
 *
 * The repo's component-test discipline drives a React Native tab through its
 * pure view-model (the load-bearing filter / sort / format logic) plus a
 * source-scan of the component — see `adminArguments.test.ts` /
 * `roomContractSeatStrip.test.tsx` for the same pattern. No runtime renderer.
 *
 * Covers:
 *  - `filterMetadataAuditEvents` — tag-code / actor-role / event-kind / search.
 *  - `formatActorRole` — honest current-role labels, never a fabricated side.
 *  - `eventMatchesRoleFilter`.
 *  - the tab's source: testIDs, a11y attributes, status states, the honest
 *    actor-role legend, the fact-only footnote, the doctrine ban-list.
 *  - the AdminScreen / types registry wiring.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  filterMetadataAuditEvents,
  formatActorRole,
  eventMatchesRoleFilter,
  ALL_AUDIT_ROLE_FILTERS,
  AUDIT_ROLE_FILTER_LABELS,
  type AuditRoleFilter,
} from '../src/features/admin/adminMetadataEventsView';
import type {
  MetadataAuditEvent,
  AuditActorRole,
} from '../src/features/admin/adminMetadataEventsApi';
import { _forbiddenMetadataTokens } from '../src/features/metadata/moveMetadataLedger';

const repoRoot = process.cwd();

// ── Fixture builder ───────────────────────────────────────────

function ev(overrides: Partial<MetadataAuditEvent> = {}): MetadataAuditEvent {
  return {
    eventId: 'pt-1:applied',
    pointTagId: 'pt-1',
    kind: 'applied',
    occurredAt: '2026-05-18T10:00:00.000Z',
    debateId: 'deb-1',
    debateTitle: 'Bike lanes resolution',
    argumentId: 'arg-1',
    argumentExcerpt: 'A claim that lacks any source.',
    argumentSide: 'affirmative',
    argumentDeleted: false,
    tagCode: 'needs_source',
    tagPlainLabel: 'Needs source',
    actorId: 'user-tagger',
    actorDisplayName: 'Tagger Tess',
    actorRole: { appRole: 'user', debateSide: 'affirmative' },
    ...overrides,
  };
}

const NO_FILTERS = { search: '', tagCode: 'all', role: 'all' as AuditRoleFilter, kind: 'all' as const };

// ── filterMetadataAuditEvents ─────────────────────────────────

describe('filterMetadataAuditEvents — tag-code chip', () => {
  it('"all" returns every event', () => {
    const events = [ev({ eventId: 'a', tagCode: 'needs_source' }), ev({ eventId: 'b', tagCode: 'tangent' })];
    expect(filterMetadataAuditEvents(events, NO_FILTERS)).toHaveLength(2);
  });

  it('a specific code narrows to that code', () => {
    const events = [
      ev({ eventId: 'a', tagCode: 'needs_source' }),
      ev({ eventId: 'b', tagCode: 'tangent' }),
    ];
    const out = filterMetadataAuditEvents(events, { ...NO_FILTERS, tagCode: 'tangent' });
    expect(out.map((e) => e.eventId)).toEqual(['b']);
  });
});

describe('filterMetadataAuditEvents — event-kind chip', () => {
  it('"applied" keeps only applied events', () => {
    const events = [ev({ eventId: 'a', kind: 'applied' }), ev({ eventId: 'b', kind: 'removed' })];
    const out = filterMetadataAuditEvents(events, { ...NO_FILTERS, kind: 'applied' });
    expect(out.map((e) => e.eventId)).toEqual(['a']);
  });

  it('"removed" keeps only removed events', () => {
    const events = [ev({ eventId: 'a', kind: 'applied' }), ev({ eventId: 'b', kind: 'removed' })];
    const out = filterMetadataAuditEvents(events, { ...NO_FILTERS, kind: 'removed' });
    expect(out.map((e) => e.eventId)).toEqual(['b']);
  });
});

describe('filterMetadataAuditEvents — actor-role chip', () => {
  it('"admin" keeps only admin-role actors', () => {
    const events = [
      ev({ eventId: 'a', actorRole: { appRole: 'admin', debateSide: null } }),
      ev({ eventId: 'b', actorRole: { appRole: 'user', debateSide: 'affirmative' } }),
    ];
    const out = filterMetadataAuditEvents(events, { ...NO_FILTERS, role: 'admin' });
    expect(out.map((e) => e.eventId)).toEqual(['a']);
  });

  it('"moderator" keeps only moderator-role actors', () => {
    const events = [
      ev({ eventId: 'a', actorRole: { appRole: 'moderator', debateSide: null } }),
      ev({ eventId: 'b', actorRole: { appRole: 'user', debateSide: 'negative' } }),
    ];
    const out = filterMetadataAuditEvents(events, { ...NO_FILTERS, role: 'moderator' });
    expect(out.map((e) => e.eventId)).toEqual(['a']);
  });

  it('"affirmative" keeps only actors on the affirmative side', () => {
    const events = [
      ev({ eventId: 'a', actorRole: { appRole: 'user', debateSide: 'affirmative' } }),
      ev({ eventId: 'b', actorRole: { appRole: 'user', debateSide: 'negative' } }),
    ];
    const out = filterMetadataAuditEvents(events, { ...NO_FILTERS, role: 'affirmative' });
    expect(out.map((e) => e.eventId)).toEqual(['a']);
  });

  it('"observer" keeps only observer-side actors', () => {
    const events = [
      ev({ eventId: 'a', actorRole: { appRole: 'user', debateSide: 'observer' } }),
      ev({ eventId: 'b', actorRole: { appRole: 'user', debateSide: 'affirmative' } }),
    ];
    const out = filterMetadataAuditEvents(events, { ...NO_FILTERS, role: 'observer' });
    expect(out.map((e) => e.eventId)).toEqual(['a']);
  });

  it('a role filter drops events whose actor role is null', () => {
    const events = [ev({ eventId: 'a', actorRole: null })];
    expect(filterMetadataAuditEvents(events, { ...NO_FILTERS, role: 'admin' })).toEqual([]);
  });
});

describe('filterMetadataAuditEvents — search box', () => {
  it('matches by argument excerpt', () => {
    const events = [
      ev({ eventId: 'a', argumentExcerpt: 'mentions widgets' }),
      ev({ eventId: 'b', argumentExcerpt: 'mentions gadgets' }),
    ];
    const out = filterMetadataAuditEvents(events, { ...NO_FILTERS, search: 'widgets' });
    expect(out.map((e) => e.eventId)).toEqual(['a']);
  });

  it('matches by actor display name', () => {
    const events = [
      ev({ eventId: 'a', actorDisplayName: 'Alice' }),
      ev({ eventId: 'b', actorDisplayName: 'Bob' }),
    ];
    const out = filterMetadataAuditEvents(events, { ...NO_FILTERS, search: 'bob' });
    expect(out.map((e) => e.eventId)).toEqual(['b']);
  });

  it('matches by debate title and by tag plain label', () => {
    const events = [
      ev({ eventId: 'a', debateTitle: 'Climate room', tagPlainLabel: 'Needs source' }),
      ev({ eventId: 'b', debateTitle: 'Bike room', tagPlainLabel: 'Tangent / side issue' }),
    ];
    expect(filterMetadataAuditEvents(events, { ...NO_FILTERS, search: 'climate' }).map((e) => e.eventId)).toEqual(['a']);
    expect(filterMetadataAuditEvents(events, { ...NO_FILTERS, search: 'tangent' }).map((e) => e.eventId)).toEqual(['b']);
  });

  it('composes search + chip filters together', () => {
    const events = [
      ev({ eventId: 'a', tagCode: 'tangent', argumentExcerpt: 'about cars' }),
      ev({ eventId: 'b', tagCode: 'tangent', argumentExcerpt: 'about bikes' }),
      ev({ eventId: 'c', tagCode: 'needs_source', argumentExcerpt: 'about cars' }),
    ];
    const out = filterMetadataAuditEvents(events, { ...NO_FILTERS, tagCode: 'tangent', search: 'cars' });
    expect(out.map((e) => e.eventId)).toEqual(['a']);
  });

  it('handles null excerpt / actor / title without crashing', () => {
    const events = [ev({ argumentExcerpt: null, actorDisplayName: null, debateTitle: null })];
    expect(filterMetadataAuditEvents(events, { ...NO_FILTERS, search: 'needs source' })).toHaveLength(1);
  });
});

// ── formatActorRole ───────────────────────────────────────────

describe('formatActorRole — honest current-role labels', () => {
  it('admin app-role → "Admin"', () => {
    expect(formatActorRole({ appRole: 'admin', debateSide: null })).toBe('Admin');
  });

  it('moderator app-role → "Moderator"', () => {
    expect(formatActorRole({ appRole: 'moderator', debateSide: null })).toBe('Moderator');
  });

  it('user + affirmative side → "Participant · Affirmative"', () => {
    expect(formatActorRole({ appRole: 'user', debateSide: 'affirmative' })).toBe('Participant · Affirmative');
  });

  it('user + negative side → "Participant · Negative"', () => {
    expect(formatActorRole({ appRole: 'user', debateSide: 'negative' })).toBe('Participant · Negative');
  });

  it('user + observer side → "Participant · Observer"', () => {
    expect(formatActorRole({ appRole: 'user', debateSide: 'observer' })).toBe('Participant · Observer');
  });

  it('user + null side → "Participant" (no fabricated side)', () => {
    expect(formatActorRole({ appRole: 'user', debateSide: null })).toBe('Participant');
  });

  it('null actor role → em dash', () => {
    expect(formatActorRole(null)).toBe('—');
    expect(formatActorRole(undefined)).toBe('—');
  });

  it('admin app-role wins even when a debate side is present', () => {
    // An admin who also joined a debate as affirmative is still labeled
    // by their app role — the column is "current role" first.
    expect(formatActorRole({ appRole: 'admin', debateSide: 'affirmative' })).toBe('Admin');
  });
});

// ── eventMatchesRoleFilter ────────────────────────────────────

describe('eventMatchesRoleFilter', () => {
  it('"all" always matches, even a null-role event', () => {
    expect(eventMatchesRoleFilter(ev({ actorRole: null }), 'all')).toBe(true);
  });

  it('every role-filter value is handled', () => {
    const role: AuditActorRole = { appRole: 'admin', debateSide: 'affirmative' };
    for (const f of ALL_AUDIT_ROLE_FILTERS) {
      // Should not throw for any filter value.
      expect(typeof eventMatchesRoleFilter(ev({ actorRole: role }), f)).toBe('boolean');
    }
  });
});

// ── Role-filter vocabulary ────────────────────────────────────

describe('AUDIT_ROLE_FILTER_LABELS — vocabulary', () => {
  it('has a label for every role-filter value', () => {
    for (const f of ALL_AUDIT_ROLE_FILTERS) {
      expect(AUDIT_ROLE_FILTER_LABELS[f].length).toBeGreaterThan(0);
    }
  });

  it('replaces the dropped "lifecycle transition" chip — no such label exists', () => {
    const allLabels = Object.values(AUDIT_ROLE_FILTER_LABELS).join(' ').toLowerCase();
    expect(allLabels).not.toContain('lifecycle');
  });

  it('contains no verdict / person-attribution token', () => {
    const banned = _forbiddenMetadataTokens();
    const allLabels = Object.values(AUDIT_ROLE_FILTER_LABELS).join(' ').toLowerCase();
    for (const tok of banned) {
      expect(allLabels).not.toContain(tok);
    }
  });
});

// ── Component source-scan ─────────────────────────────────────

describe('AdminMetadataEventsTab — source contract', () => {
  const src = fs.readFileSync(
    path.join(repoRoot, 'src/features/admin/AdminMetadataEventsTab.tsx'),
    'utf8',
  );

  it('renders the required table + filter + cell testIDs', () => {
    for (const id of [
      'admin-metadata-events-table',
      'admin-metadata-events-header-created',
      'admin-metadata-events-cell-created',
      'admin-metadata-events-debate-selector',
      'admin-metadata-events-filter-tag',
      'admin-metadata-events-filter-role',
      'admin-metadata-events-filter-kind',
    ]) {
      expect(src).toContain(`testID="${id}"`);
    }
  });

  it('renders all six columns (Created is an inline sortable header)', () => {
    // Five columns use the PlainHeader `label="…"` prop; Created is rendered
    // inline as a sortable Pressable.
    for (const label of ['Event', 'Debate', 'Move', 'Tag', 'Actor — current role']) {
      expect(src).toContain(`label="${label}"`);
    }
    expect(src).toMatch(/Created\{sortArrow\(sortDirection\)\}/);
  });

  it('renders loading / error / empty / filtered-empty / no-debate status states', () => {
    expect(src).toContain('admin-metadata-events-no-debate');
    expect(src).toContain('admin-metadata-events-loading');
    expect(src).toContain('admin-metadata-events-error');
    expect(src).toContain('admin-metadata-events-empty');
    expect(src).toContain('admin-metadata-events-empty-filtered');
    expect(src).toMatch(/Pick a debate above to load its tag history/);
    expect(src).toMatch(/Loading tag history…/);
    expect(src).toMatch(/Could not load tag history\. Check admin access and try again\./);
    expect(src).toMatch(/No tag activity in this debate yet/);
    expect(src).toMatch(/No tag events match these filters/);
  });

  it('renders the honest actor-role legend (current values, not apply-time)', () => {
    expect(src).toContain('admin-metadata-events-role-legend');
    expect(src).toMatch(/current values, not necessarily their role when the tag was applied/);
  });

  it('renders a fact-only footnote that makes no judgment about a person', () => {
    expect(src).toMatch(/makes no judgment about any person/);
    expect(src).toMatch(/audit view of tag activity/);
  });

  it('the Created header is a sortable Pressable with a11y role + state + hint', () => {
    expect(src).toContain('accessibilityRole="button"');
    expect(src).toMatch(/accessibilityLabel="Sort by Created"/);
    expect(src).toMatch(/accessibilityHint=\{directionHint\}/);
    expect(src).toMatch(/toggleSort/);
  });

  it('the sort-status text reflects direction', () => {
    expect(src).toContain('admin-metadata-events-sort-status');
    expect(src).toMatch(/Newest first/);
    expect(src).toMatch(/Oldest first/);
  });

  it('event badge distinguishes Applied vs Removed by text + border shape, not color alone', () => {
    expect(src).toContain("'Applied'");
    expect(src).toContain("'Removed'");
    expect(src).toMatch(/borderStyle:\s*'solid'/);
    expect(src).toMatch(/borderStyle:\s*'dashed'/);
  });

  it('chips meet the 44x44 hit target via hitSlop', () => {
    expect(src).toMatch(/hitSlop=\{\{/);
  });

  it('every filter chip / debate chip / refresh exposes a11y role + label + state', () => {
    expect(src).toMatch(/accessibilityRole="button"/);
    expect(src).toMatch(/accessibilityState=\{\{ selected/);
    expect(src).toMatch(/accessibilityLabel=\{`Filter \$\{group\}: \$\{label\}`\}/);
  });

  it('uses formatDateTime + formatRelativeShort for the Created cell (separate Text elements)', () => {
    expect(src).toContain('formatDateTime(e.occurredAt)');
    expect(src).toContain('formatRelativeShort(e.occurredAt)');
    expect(src).toMatch(/styles\.timeAbsolute/);
    expect(src).toMatch(/styles\.timeRelative/);
  });

  it('renders tag labels via getManualTagPlainLabel — never a raw tag_code', () => {
    expect(src).toContain('getManualTagPlainLabel');
    expect(src).toContain('tagPlainLabel');
  });

  it('shows a "deleted move" sub-label for soft-deleted arguments (edge case #7)', () => {
    expect(src).toMatch(/deleted move/);
    expect(src).toContain('argumentDeleted');
  });

  it('does not log Authorization headers or reference service-role keys', () => {
    expect(src).not.toMatch(/console\.(log|error|warn)/);
    expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    expect(src).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{16,}/);
    expect(src).not.toMatch(/createClient\(/);
  });

  it('fact-only ban-list — no verdict / person-attribution token in user-facing copy', () => {
    // Doctrine scope is RENDERED strings, not JS identifiers / comments /
    // props. Strip block + line comments first, then extract user-facing
    // copy (JSX text nodes + quoted string literals) and scan that subset.
    // This mirrors the narrow ban-list pattern in adminArguments.test.ts.
    const noComments = src
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ');
    const jsxText = (noComments.match(/>[^<>{}]+</g) ?? []).join(' ');
    const quoted = (noComments.match(/'[^']*'|"[^"]*"/g) ?? []).join(' ');
    const copy = `${jsxText} ${quoted}`.toLowerCase();
    // Verdict / person-attribution tokens that must never reach a user.
    for (const tok of [
      'winner', 'loser', 'liar', 'dishonest', 'bad faith', 'manipulative',
      'extremist', 'propagandist', 'astroturfer', 'verdict', 'truth',
    ]) {
      expect(copy).not.toContain(tok);
    }
  });

  it('the doctrine ban-list source is available for the test (sanity)', () => {
    // _forbiddenMetadataTokens is the canonical list; assert it is importable
    // and non-trivial so the data-layer suite's full scan stays meaningful.
    expect(_forbiddenMetadataTokens().length).toBeGreaterThan(10);
  });
});

// ── Registry wiring ───────────────────────────────────────────

describe('AdminScreen / types — metadata_events tab registry', () => {
  it('AdminTab union includes metadata_events', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'src/features/admin/types.ts'), 'utf8');
    expect(src).toContain("'metadata_events'");
    expect(src).toMatch(/metadata_events\s*:\s*['"]Metadata Events['"]/);
  });

  it('AdminScreen registers the metadata_events tab and renders AdminMetadataEventsTab', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'src/features/admin/AdminScreen.tsx'), 'utf8');
    expect(src).toContain("'metadata_events'");
    expect(src).toContain('AdminMetadataEventsTab');
    expect(src).toMatch(/tab === 'metadata_events' && <AdminMetadataEventsTab \/>/);
  });
});
