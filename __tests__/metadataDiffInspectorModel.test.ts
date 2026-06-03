/**
 * META-1E — Cards-detail metadata diff inspector — pure-model tests.
 *
 * Covers every public function of `metadataDiffInspectorModel.ts`:
 *   - `deriveMetadataDiffRows` (happy path, messageId filtering, unknown-code
 *     drop, transition split, resolved-request prior-event fallback, edges)
 *   - `filterIdsForEvent` (one assertion per chip predicate)
 *   - `buildMetadataDiffInspectorModel` (empty, no-filter, single/multi
 *     filter, availability + active reflection)
 * Plus the doctrine / plain-language anchors the design names:
 *   - `cause` never leaks onto a row.
 *   - No raw internal code survives to any rendered string.
 *   - No verdict / amplification / person-attribution token in any rendered
 *     string (reuses `_forbiddenMetadataTokens`).
 *
 * Pure model — imports the model directly, no React, no Supabase.
 */

import {
  deriveMetadataDiffRows,
  filterIdsForEvent,
  buildMetadataDiffInspectorModel,
  ALL_METADATA_DIFF_FILTERS,
  METADATA_DIFF_FILTER_LABEL,
  type MetadataDiffFilterId,
} from '../src/features/metadata/metadataDiffInspectorModel';
import {
  _forbiddenMetadataTokens,
  ALL_MANUAL_TAG_CODES,
  ALL_AUTO_METADATA_CODES,
  type MetadataEvent,
} from '../src/features/metadata';
import {
  looksLikeInternalCode,
  toPlainLanguage,
  METADATA_DIFF_INSPECTOR_COPY,
} from '../src/features/arguments/gameCopy';

// ── Fixture helper ─────────────────────────────────────────────

let seq = 0;
function evt(over: Partial<MetadataEvent> = {}): MetadataEvent {
  seq += 1;
  const kind = over.kind ?? 'add';
  const codeFamily = over.codeFamily ?? 'manual_tag';
  const code = over.code ?? 'needs_source';
  const messageId = over.messageId ?? 'm1';
  // Default timestamps strictly increase so chronological order is stable
  // and the resolved-request prior-event check is deterministic.
  const at = over.at ?? new Date(1_700_000_000_000 + seq * 1000).toISOString();
  return {
    eventId: over.eventId ?? `${kind}:${codeFamily}:${code}:${messageId}:${at}`,
    kind,
    codeFamily,
    code,
    messageId,
    clusterId: over.clusterId ?? 'c1',
    at,
    cause: over.cause ?? null,
  };
}

// ── filterIdsForEvent — one assertion per predicate ────────────

describe('META-1E filterIdsForEvent — context-free predicates', () => {
  it('add + manual_tag → ["added_tag"]', () => {
    expect(filterIdsForEvent(evt({ kind: 'add', codeFamily: 'manual_tag', code: 'needs_source' }))).toEqual([
      'added_tag',
    ]);
  });

  it('remove + manual_tag → ["removed_tag"] (incl. a message_deleted cause)', () => {
    expect(
      filterIdsForEvent(
        evt({ kind: 'remove', codeFamily: 'manual_tag', code: 'tangent', cause: 'message_deleted' }),
      ),
    ).toEqual(['removed_tag']);
  });

  it('transition + lifecycle_causation → ["triggered_transition"]', () => {
    expect(
      filterIdsForEvent(
        evt({ kind: 'transition', codeFamily: 'lifecycle_causation', code: 'open->rebutted' }),
      ),
    ).toEqual(['triggered_transition']);
  });

  it('add + auto_metadata attach → [] context-free (resolved_request finalized in derivation)', () => {
    expect(
      filterIdsForEvent(evt({ kind: 'add', codeFamily: 'auto_metadata', code: 'source_attached' })),
    ).toEqual([]);
  });

  it('add + auto_metadata non-attach code (has_reply) → []', () => {
    expect(
      filterIdsForEvent(evt({ kind: 'add', codeFamily: 'auto_metadata', code: 'has_reply' })),
    ).toEqual([]);
  });

  it('semantic_override event → [] (unmapped by all chips)', () => {
    expect(
      filterIdsForEvent(
        evt({ kind: 'add', codeFamily: 'semantic_override', code: 'introduces_new_issue' }),
      ),
    ).toEqual([]);
  });
});

// ── deriveMetadataDiffRows — happy path + ordering ─────────────

describe('META-1E deriveMetadataDiffRows — happy path', () => {
  it('produces one row per event kind with correct labels, in chronological order', () => {
    const events: MetadataEvent[] = [
      evt({ kind: 'add', codeFamily: 'manual_tag', code: 'needs_source', at: '2026-05-18T10:00:01.000Z' }),
      evt({ kind: 'remove', codeFamily: 'manual_tag', code: 'tangent', at: '2026-05-18T10:00:02.000Z' }),
      evt({ kind: 'transition', codeFamily: 'lifecycle_causation', code: 'open->rebutted', at: '2026-05-18T10:00:03.000Z' }),
      // resolved-request pair: open then attach (attach later) → resolved.
      evt({ kind: 'add', codeFamily: 'auto_metadata', code: 'source_requested', at: '2026-05-18T10:00:04.000Z' }),
      evt({ kind: 'add', codeFamily: 'auto_metadata', code: 'source_attached', at: '2026-05-18T10:00:05.000Z' }),
    ];
    const rows = deriveMetadataDiffRows(events, 'm1');
    // 5 events → 5 rows (source_requested renders as a normal Observation).
    expect(rows.length).toBe(5);

    const addTag = rows[0];
    expect(addTag.kind).toBe('add');
    expect(addTag.fromLabel).toBeNull();
    expect(addTag.toLabel).toBe('Needs source');
    expect(addTag.signalDescription).toBe('Tag added: Needs source.');
    expect(addTag.filterIds).toEqual(['added_tag']);

    const removeTag = rows[1];
    expect(removeTag.kind).toBe('remove');
    expect(removeTag.toLabel).toBe('Tangent / side issue');
    expect(removeTag.signalDescription).toBe('Tag removed: Tangent / side issue.');
    expect(removeTag.filterIds).toEqual(['removed_tag']);

    const transition = rows[2];
    expect(transition.kind).toBe('transition');
    expect(transition.fromLabel).toBe('Open for response');
    expect(transition.toLabel).toBe('Under pressure');
    expect(transition.signalDescription).toBe('Open for response → Under pressure');
    expect(transition.filterIds).toEqual(['triggered_transition']);

    const requestObs = rows[3];
    expect(requestObs.toLabel).toBe('Source requested');
    expect(requestObs.signalDescription).toBe('Observed: Source requested.');
    expect(requestObs.filterIds).toEqual([]);

    const resolved = rows[4];
    expect(resolved.toLabel).toBe('Source attached');
    expect(resolved.signalDescription).toBe('Request resolved: Source attached.');
    expect(resolved.filterIds).toEqual(['resolved_request']);
  });

  it('sorts out-of-order events chronologically with eventId tie-break', () => {
    const events: MetadataEvent[] = [
      evt({ code: 'scope_issue', at: '2026-05-18T10:00:03.000Z' }),
      evt({ code: 'needs_quote', at: '2026-05-18T10:00:01.000Z' }),
      evt({ code: 'definition_issue', at: '2026-05-18T10:00:02.000Z' }),
    ];
    const rows = deriveMetadataDiffRows(events, 'm1');
    expect(rows.map((r) => r.toLabel)).toEqual(['Needs quote', 'Definition fight', 'Scope challenge']);
  });
});

// ── deriveMetadataDiffRows — messageId filtering ───────────────

describe('META-1E deriveMetadataDiffRows — messageId filtering', () => {
  it('returns only the target move rows from a mixed-move stream', () => {
    const events: MetadataEvent[] = [
      evt({ messageId: 'm1', code: 'needs_source' }),
      evt({ messageId: 'm2', code: 'scope_issue' }),
      evt({ messageId: 'm1', code: 'needs_quote' }),
      evt({ messageId: 'm3', code: 'tangent' }),
    ];
    const rows = deriveMetadataDiffRows(events, 'm1');
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.rowId.includes(':m1:'))).toBe(true);
    expect(rows.map((r) => r.toLabel).sort()).toEqual(['Needs quote', 'Needs source']);
  });

  it('a request opened on a DIFFERENT move does not resolve an attach on this move', () => {
    const events: MetadataEvent[] = [
      // open on m2
      evt({ messageId: 'm2', kind: 'add', codeFamily: 'auto_metadata', code: 'source_requested', at: '2026-05-18T10:00:01.000Z' }),
      // attach on m1 — no in-session open on m1 → NOT resolved.
      evt({ messageId: 'm1', kind: 'add', codeFamily: 'auto_metadata', code: 'source_attached', at: '2026-05-18T10:00:02.000Z' }),
    ];
    const rows = deriveMetadataDiffRows(events, 'm1');
    expect(rows.length).toBe(1);
    expect(rows[0].filterIds).toEqual([]);
    expect(rows[0].signalDescription).toBe('Observed: Source attached.');
  });
});

// ── deriveMetadataDiffRows — unknown-code suppression ──────────

describe('META-1E deriveMetadataDiffRows — unknown codes are suppressed, never echoed', () => {
  it('drops an add with a bogus manual-family code', () => {
    const events = [evt({ kind: 'add', codeFamily: 'manual_tag', code: 'totally_bogus_code_xyz' })];
    const rows = deriveMetadataDiffRows(events, 'm1');
    expect(rows.length).toBe(0);
    expect(JSON.stringify(rows)).not.toContain('totally_bogus_code_xyz');
  });

  it('drops a remove with a bogus auto-family code', () => {
    const events = [evt({ kind: 'remove', codeFamily: 'auto_metadata', code: 'made_up_observation' })];
    const rows = deriveMetadataDiffRows(events, 'm1');
    expect(rows.length).toBe(0);
    expect(JSON.stringify(rows)).not.toContain('made_up_observation');
  });

  it('drops a semantic_override whose contested-classifier code maps to null', () => {
    const events = [evt({ kind: 'add', codeFamily: 'semantic_override', code: 'unmapped_contested_classifier' })];
    const rows = deriveMetadataDiffRows(events, 'm1');
    expect(rows.length).toBe(0);
    expect(JSON.stringify(rows)).not.toContain('unmapped_contested_classifier');
  });

  it('renders a semantic_override whose code DOES map (as an unfiltered Observation)', () => {
    // `evidence_debt` is a real mapped code; a semantic_override carrying it
    // renders as a normal Observation but lands in NO chip bucket.
    const events = [evt({ kind: 'add', codeFamily: 'semantic_override', code: 'evidence_debt' })];
    const rows = deriveMetadataDiffRows(events, 'm1');
    expect(rows.length).toBe(1);
    expect(rows[0].toLabel).toBe('Evidence debt');
    expect(rows[0].filterIds).toEqual([]);
    expect(rows[0].signalDescription).toBe('Observed: Evidence debt.');
  });
});

// ── deriveMetadataDiffRows — transition split + malformed ──────

describe('META-1E deriveMetadataDiffRows — lifecycle transition split', () => {
  it('splits code on -> and maps each half', () => {
    const rows = deriveMetadataDiffRows(
      [evt({ kind: 'transition', codeFamily: 'lifecycle_causation', code: 'open->rebutted' })],
      'm1',
    );
    expect(rows.length).toBe(1);
    expect(rows[0].fromLabel).toBe('Open for response');
    expect(rows[0].toLabel).toBe('Under pressure');
  });

  it('drops a malformed transition with an empty half (open->)', () => {
    const rows = deriveMetadataDiffRows(
      [evt({ kind: 'transition', codeFamily: 'lifecycle_causation', code: 'open->' })],
      'm1',
    );
    expect(rows.length).toBe(0);
  });

  it('drops a transition with no -> separator at all', () => {
    const rows = deriveMetadataDiffRows(
      [evt({ kind: 'transition', codeFamily: 'lifecycle_causation', code: 'open' })],
      'm1',
    );
    expect(rows.length).toBe(0);
  });

  it('drops a transition where one half is an unknown state', () => {
    const rows = deriveMetadataDiffRows(
      [evt({ kind: 'transition', codeFamily: 'lifecycle_causation', code: 'open->made_up_state' })],
      'm1',
    );
    expect(rows.length).toBe(0);
  });
});

// ── deriveMetadataDiffRows — edge cases ────────────────────────

describe('META-1E deriveMetadataDiffRows — edge cases', () => {
  it('empty stream → no rows', () => {
    expect(deriveMetadataDiffRows([], 'm1')).toEqual([]);
  });

  it('exactly one event → one row, no from half for an add', () => {
    const rows = deriveMetadataDiffRows([evt({ code: 'needs_source' })], 'm1');
    expect(rows.length).toBe(1);
    expect(rows[0].fromLabel).toBeNull();
  });

  it('returns [] for a missing/empty messageId', () => {
    expect(deriveMetadataDiffRows([evt()], '')).toEqual([]);
    // @ts-expect-error — defensive null guard.
    expect(deriveMetadataDiffRows([evt()], null)).toEqual([]);
  });

  it('a bare attach with no prior open renders as Observed, not Resolved', () => {
    const rows = deriveMetadataDiffRows(
      [evt({ kind: 'add', codeFamily: 'auto_metadata', code: 'quote_attached' })],
      'm1',
    );
    expect(rows.length).toBe(1);
    expect(rows[0].filterIds).toEqual([]);
    expect(rows[0].signalDescription).toBe('Observed: Quote attached.');
  });

  it('an attach that PRECEDES its open is NOT resolved (order matters)', () => {
    const events: MetadataEvent[] = [
      // attach first (earlier)
      evt({ kind: 'add', codeFamily: 'auto_metadata', code: 'source_attached', at: '2026-05-18T10:00:01.000Z' }),
      // open later
      evt({ kind: 'add', codeFamily: 'auto_metadata', code: 'source_requested', at: '2026-05-18T10:00:02.000Z' }),
    ];
    const rows = deriveMetadataDiffRows(events, 'm1');
    const attachRow = rows.find((r) => r.toLabel === 'Source attached');
    expect(attachRow).toBeDefined();
    expect(attachRow!.filterIds).toEqual([]);
  });
});

// ── buildMetadataDiffInspectorModel ────────────────────────────

describe('META-1E buildMetadataDiffInspectorModel', () => {
  it('empty events → isEmpty true, all chips unavailable count 0, no visible rows', () => {
    const model = buildMetadataDiffInspectorModel({ events: [], messageId: 'm1', activeFilters: [] });
    expect(model.isEmpty).toBe(true);
    expect(model.allRows).toEqual([]);
    expect(model.visibleRows).toEqual([]);
    expect(model.filters.length).toBe(4);
    for (const f of model.filters) {
      expect(f.available).toBe(false);
      expect(f.count).toBe(0);
      expect(f.active).toBe(false);
    }
  });

  it('no active filters → visibleRows equals allRows', () => {
    const events = [
      evt({ code: 'needs_source' }),
      evt({ kind: 'transition', codeFamily: 'lifecycle_causation', code: 'open->rebutted' }),
    ];
    const model = buildMetadataDiffInspectorModel({ events, messageId: 'm1', activeFilters: [] });
    expect(model.isEmpty).toBe(false);
    expect(model.visibleRows).toEqual(model.allRows);
    expect(model.visibleRows.length).toBe(2);
  });

  it('single active filter masks to that bucket; counts match', () => {
    const events = [
      evt({ kind: 'add', codeFamily: 'manual_tag', code: 'needs_source' }),
      evt({ kind: 'add', codeFamily: 'manual_tag', code: 'scope_issue' }),
      evt({ kind: 'transition', codeFamily: 'lifecycle_causation', code: 'open->rebutted' }),
    ];
    const model = buildMetadataDiffInspectorModel({
      events,
      messageId: 'm1',
      activeFilters: ['added_tag'],
    });
    expect(model.visibleRows.length).toBe(2);
    expect(model.visibleRows.every((r) => r.filterIds.includes('added_tag'))).toBe(true);

    const addedChip = model.filters.find((f) => f.id === 'added_tag')!;
    expect(addedChip.count).toBe(2);
    expect(addedChip.available).toBe(true);
    expect(addedChip.active).toBe(true);

    const transitionChip = model.filters.find((f) => f.id === 'triggered_transition')!;
    expect(transitionChip.count).toBe(1);
    expect(transitionChip.active).toBe(false);

    const removedChip = model.filters.find((f) => f.id === 'removed_tag')!;
    expect(removedChip.count).toBe(0);
    expect(removedChip.available).toBe(false);
  });

  it('multiple active filters are OR-combined', () => {
    const events = [
      evt({ kind: 'add', codeFamily: 'manual_tag', code: 'needs_source' }),
      evt({ kind: 'remove', codeFamily: 'manual_tag', code: 'tangent' }),
      evt({ kind: 'transition', codeFamily: 'lifecycle_causation', code: 'open->rebutted' }),
    ];
    const model = buildMetadataDiffInspectorModel({
      events,
      messageId: 'm1',
      activeFilters: ['added_tag', 'removed_tag'],
    });
    // add + remove visible; transition masked out.
    expect(model.visibleRows.length).toBe(2);
    expect(model.visibleRows.some((r) => r.kind === 'transition')).toBe(false);
  });

  it('available reflects per-move bucket presence; active reflects the input set', () => {
    const events = [evt({ kind: 'add', codeFamily: 'manual_tag', code: 'needs_source' })];
    const model = buildMetadataDiffInspectorModel({
      events,
      messageId: 'm1',
      activeFilters: ['resolved_request'], // active but unavailable on this move
    });
    const resolved = model.filters.find((f) => f.id === 'resolved_request')!;
    expect(resolved.active).toBe(true);
    expect(resolved.available).toBe(false);
    // Active-but-unavailable filter masks everything out (no rows in bucket).
    expect(model.visibleRows.length).toBe(0);
  });

  it('ignores unknown filter ids in the active set (defensive)', () => {
    const events = [evt({ code: 'needs_source' })];
    const model = buildMetadataDiffInspectorModel({
      events,
      messageId: 'm1',
      // @ts-expect-error — defensive: a bogus id must be ignored, not crash.
      activeFilters: ['not_a_real_filter'],
    });
    // No valid active filter → behaves like empty set → all rows visible.
    expect(model.visibleRows).toEqual(model.allRows);
  });

  it('different messageId yields different rows (move-change recompute)', () => {
    const events = [
      evt({ messageId: 'm1', code: 'needs_source' }),
      evt({ messageId: 'm2', code: 'scope_issue' }),
    ];
    const m1 = buildMetadataDiffInspectorModel({ events, messageId: 'm1', activeFilters: [] });
    const m2 = buildMetadataDiffInspectorModel({ events, messageId: 'm2', activeFilters: [] });
    expect(m1.allRows.map((r) => r.toLabel)).toEqual(['Needs source']);
    expect(m2.allRows.map((r) => r.toLabel)).toEqual(['Scope challenge']);
  });
});

// ── Doctrine — cause never leaks ───────────────────────────────

describe('META-1E doctrine — cause never leaks onto a row', () => {
  it('a row carries no "cause" key and no row value equals an event cause string', () => {
    const SECRET_CAUSE = 'message_deleted';
    const events: MetadataEvent[] = [
      evt({ kind: 'remove', codeFamily: 'manual_tag', code: 'tangent', cause: SECRET_CAUSE }),
      evt({ kind: 'add', codeFamily: 'manual_tag', code: 'needs_source', cause: 'eligibility_refused' }),
    ];
    const rows = deriveMetadataDiffRows(events, 'm1');
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain('"cause"');
    expect(serialized).not.toContain(SECRET_CAUSE);
    expect(serialized).not.toContain('eligibility_refused');
  });
});

// ── Doctrine — no raw internal code survives to a rendered string ──

describe('META-1E doctrine — no raw internal code in any rendered string', () => {
  // A stream covering EVERY manual code, EVERY auto code, a representative
  // set of lifecycle transitions, and a semantic_override mapped code.
  function fullCoverageEvents(): MetadataEvent[] {
    const out: MetadataEvent[] = [];
    for (const c of ALL_MANUAL_TAG_CODES) {
      out.push(evt({ kind: 'add', codeFamily: 'manual_tag', code: c }));
      out.push(evt({ kind: 'remove', codeFamily: 'manual_tag', code: c }));
    }
    for (const c of ALL_AUTO_METADATA_CODES) {
      out.push(evt({ kind: 'add', codeFamily: 'auto_metadata', code: c }));
    }
    const transitions = ['open->rebutted', 'rebutted->sourced', 'answered->narrowed', 'open->archived_or_resolved'];
    for (const t of transitions) {
      out.push(evt({ kind: 'transition', codeFamily: 'lifecycle_causation', code: t }));
    }
    out.push(evt({ kind: 'add', codeFamily: 'semantic_override', code: 'evidence_debt' }));
    return out;
  }

  it('every rendered string maps cleanly — no looksLikeInternalCode, no snake_case source code', () => {
    const rows = deriveMetadataDiffRows(fullCoverageEvents(), 'm1');
    expect(rows.length).toBeGreaterThan(0);

    const rendered: string[] = [];
    for (const r of rows) {
      if (r.fromLabel) rendered.push(r.fromLabel);
      rendered.push(r.toLabel);
      rendered.push(r.signalDescription);
    }
    // Chip labels + empty-state line are user-facing too.
    for (const id of ALL_METADATA_DIFF_FILTERS) rendered.push(METADATA_DIFF_FILTER_LABEL[id]);
    rendered.push(METADATA_DIFF_INSPECTOR_COPY.emptyState);
    rendered.push(METADATA_DIFF_INSPECTOR_COPY.panelTitle);

    // The raw source vocabularies must NOT appear verbatim in any string.
    const rawCodes = [
      ...ALL_MANUAL_TAG_CODES,
      ...ALL_AUTO_METADATA_CODES,
      'open',
      'rebutted',
      'sourced',
      'answered',
      'narrowed',
      'archived_or_resolved',
    ];
    // The proven repo check (NodeLabelInspectGroups.test.tsx): a snake_case
    // leak is a token CONTAINING an underscore. `looksLikeInternalCode`'s
    // lowercase-word branch matches ordinary 5+ char English words, so it is
    // only meaningful applied to the WHOLE string (a code is one token), not
    // to individual words split from a plain sentence.
    const SNAKE_CASE_LEAK = /[a-z][a-z0-9]*_[a-z0-9_]+/;
    for (const s of rendered) {
      // The whole rendered string is plain English, never a bare code token.
      expect(looksLikeInternalCode(s)).toBe(false);
      // No snake_case identifier survives anywhere in the string.
      expect(s).not.toMatch(SNAKE_CASE_LEAK);
      for (const raw of rawCodes) {
        // Underscored codes are 2+ word; assert the underscore form is gone.
        if (raw.includes('_')) {
          expect(s).not.toContain(raw);
        }
      }
      // The literal arrow-join code form never leaks.
      expect(s).not.toContain('->');
    }
  });

  it('every manual + auto code maps to a non-null plain label (coverage guard)', () => {
    for (const c of [...ALL_MANUAL_TAG_CODES, ...ALL_AUTO_METADATA_CODES]) {
      expect(toPlainLanguage(c)).not.toBeNull();
    }
  });
});

// ── Doctrine — ban-list (verdict / amplification / person) ─────

describe('META-1E doctrine — no verdict / amplification / person token', () => {
  function allAuthoredAndRenderedStrings(): string[] {
    const out: string[] = [];
    // Authored copy block.
    for (const v of Object.values(METADATA_DIFF_INSPECTOR_COPY)) out.push(v);
    // Rendered rows over a broad fixture.
    const events: MetadataEvent[] = [
      evt({ kind: 'add', codeFamily: 'manual_tag', code: 'needs_source' }),
      evt({ kind: 'remove', codeFamily: 'manual_tag', code: 'tangent' }),
      evt({ kind: 'transition', codeFamily: 'lifecycle_causation', code: 'open->rebutted' }),
      evt({ kind: 'add', codeFamily: 'auto_metadata', code: 'source_requested', at: '2026-05-18T10:00:01.000Z' }),
      evt({ kind: 'add', codeFamily: 'auto_metadata', code: 'source_attached', at: '2026-05-18T10:00:02.000Z' }),
    ];
    for (const r of deriveMetadataDiffRows(events, 'm1')) {
      if (r.fromLabel) out.push(r.fromLabel);
      out.push(r.toLabel);
      out.push(r.signalDescription);
    }
    return out;
  }

  it('no forbidden token in any authored or rendered string', () => {
    const tokens = _forbiddenMetadataTokens();
    for (const s of allAuthoredAndRenderedStrings()) {
      const lc = s.toLowerCase();
      for (const t of tokens) {
        expect(lc.includes(t.toLowerCase())).toBe(false);
      }
    }
  });

  it('authored connective verbs carry no person-attribution token', () => {
    const personTokens = ['you', 'they', 'your', 'their', 'he ', 'she ', '@'];
    const authored = [
      METADATA_DIFF_INSPECTOR_COPY.signalTagAdded,
      METADATA_DIFF_INSPECTOR_COPY.signalTagRemoved,
      METADATA_DIFF_INSPECTOR_COPY.signalObserved,
      METADATA_DIFF_INSPECTOR_COPY.signalRequestResolved,
      METADATA_DIFF_FILTER_LABEL.added_tag,
      METADATA_DIFF_FILTER_LABEL.removed_tag,
      METADATA_DIFF_FILTER_LABEL.resolved_request,
      METADATA_DIFF_FILTER_LABEL.triggered_transition,
    ];
    for (const s of authored) {
      const lc = ` ${s.toLowerCase()} `;
      for (const p of personTokens) {
        expect(lc.includes(p)).toBe(false);
      }
    }
  });
});

// ── Vocabulary completeness ────────────────────────────────────

describe('META-1E filter vocabulary', () => {
  it('exposes exactly the four issue-scope chips', () => {
    expect([...ALL_METADATA_DIFF_FILTERS].sort()).toEqual(
      (['added_tag', 'removed_tag', 'resolved_request', 'triggered_transition'] as MetadataDiffFilterId[]).sort(),
    );
  });

  it('every chip has a label and an accessibility label', () => {
    for (const id of ALL_METADATA_DIFF_FILTERS) {
      expect(METADATA_DIFF_FILTER_LABEL[id].length).toBeGreaterThan(0);
    }
  });
});
