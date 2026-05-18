import {
  ALL_EVIDENCE_ARTIFACT_KINDS,
  ALL_EVIDENCE_RISKS,
  ALL_SOURCE_CHAIN_STATUSES,
  buildEvidenceArtifacts,
  classifyEvidenceKind,
  deriveSourceChainStatus,
  getTimelineEvidenceContract,
  summarizeArtifactsForReceiptChip,
} from '../src/features/evidence';
import type {
  EvidenceArtifact,
  EvidenceArtifactKind,
  EvidenceAttachmentInput,
  EvidenceRisk,
  ReceiptChipContract,
  SourceChainStatus,
} from '../src/features/evidence';

import { evaluateArgumentDraft } from '../src/domain/constitution/evaluateArgumentDraft';
import {
  constitutionRules,
  tagDefinitions,
  flagDefinitions,
  constitutionVersion,
} from '../src/domain/constitution/constitution.v1';
import type { ArgumentDraftEvaluationInput } from '../src/domain/constitution/types';

// ── Helpers ────────────────────────────────────────────────────

const ARG_ID = 'arg-fixture-1';
const USER_ID = 'user-fixture-1';
const CREATED_AT = '2026-05-18T10:00:00.000Z';

function buildOne(att: EvidenceAttachmentInput): EvidenceArtifact[] {
  return buildEvidenceArtifacts({
    argumentId: ARG_ID,
    addedByUserId: USER_ID,
    createdAt: CREATED_AT,
    attachments: [att],
  });
}

function fixtureArtifact(status: Exclude<SourceChainStatus, 'no_source'>): EvidenceArtifact {
  return {
    id: `${ARG_ID}:evidence:0`,
    argumentId: ARG_ID,
    kind: 'url',
    label: 'Example source',
    url: 'https://example.com/article',
    sourceChainStatus: status,
    risk: 'unknown',
    addedByUserId: USER_ID,
    createdAt: CREATED_AT,
  };
}

// EV-001 forbidden tokens (verdict / person labels / raw codes). The
// system-generated chip + timeline strings must never contain any of these.
const BANNED_TOKENS: ReadonlyArray<string> = [
  'winner',
  'loser',
  'correct',
  'incorrect',
  'true',
  'false',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'troll',
  'bot',
  'astroturfer',
  'verdict',
  'proof',
  'proven',
  'disproven',
];

// ── Shape + enum coverage ──────────────────────────────────────

describe('EV-001 — shape + enum coverage', () => {
  test('EvidenceArtifactKind exposes the six documented values via ALL_EVIDENCE_ARTIFACT_KINDS', () => {
    expect(ALL_EVIDENCE_ARTIFACT_KINDS).toHaveLength(6);
    expect([...ALL_EVIDENCE_ARTIFACT_KINDS].sort()).toEqual(
      [
        'url',
        'quote',
        'source_text',
        'dataset',
        'screenshot_redacted',
        'manual_citation',
      ].sort(),
    );
  });

  test('SourceChainStatus exposes exactly six values including no_source', () => {
    expect(ALL_SOURCE_CHAIN_STATUSES).toHaveLength(6);
    expect([...ALL_SOURCE_CHAIN_STATUSES].sort()).toEqual(
      [
        'no_source',
        'unverified',
        'source_no_quote',
        'source_and_quote',
        'broken',
        'primary_present',
      ].sort(),
    );
    expect(ALL_SOURCE_CHAIN_STATUSES).toContain('no_source');
  });

  test('EvidenceRisk exposes the four documented values', () => {
    expect(ALL_EVIDENCE_RISKS).toHaveLength(4);
    expect([...ALL_EVIDENCE_RISKS].sort()).toEqual(['low', 'medium', 'high', 'unknown'].sort());
  });

  test('ALL_* arrays are frozen', () => {
    expect(Object.isFrozen(ALL_EVIDENCE_ARTIFACT_KINDS)).toBe(true);
    expect(Object.isFrozen(ALL_SOURCE_CHAIN_STATUSES)).toBe(true);
    expect(Object.isFrozen(ALL_EVIDENCE_RISKS)).toBe(true);
  });

  test('EvidenceArtifact object literal type-checks at minimum example values', () => {
    const artifact: EvidenceArtifact = {
      id: 'a:evidence:0',
      argumentId: 'a',
      kind: 'url',
      label: 'L',
      sourceChainStatus: 'unverified',
      risk: 'unknown',
      addedByUserId: 'u',
      createdAt: CREATED_AT,
    };
    expect(artifact.kind).toBe('url');
  });

  test('does not include popularity-shaped values as evidence kinds', () => {
    const popularityShaped = [
      'likes',
      'retweets',
      'shares',
      'views',
      'followers',
      'verified',
      'engagement',
      'amplification',
      'trending',
      'virality',
    ];
    for (const k of ALL_EVIDENCE_ARTIFACT_KINDS) {
      for (const b of popularityShaped) {
        expect(k.toLowerCase()).not.toContain(b);
      }
    }
  });
});

// ── deriveSourceChainStatus — decision table ───────────────────

describe('EV-001 — deriveSourceChainStatus decision table', () => {
  test('no fields present → unverified (defensive; unreachable from adapter)', () => {
    expect(deriveSourceChainStatus({})).toBe('unverified');
  });

  test('url only → source_no_quote', () => {
    expect(deriveSourceChainStatus({ url: 'https://example.com' })).toBe('source_no_quote');
  });

  test('sourceText only → source_no_quote', () => {
    expect(deriveSourceChainStatus({ sourceText: 'Excerpt from paper' })).toBe('source_no_quote');
  });

  test('url + sourceText, no quote → source_no_quote', () => {
    expect(
      deriveSourceChainStatus({ url: 'https://example.com', sourceText: 'Excerpt' }),
    ).toBe('source_no_quote');
  });

  test('url + quote → source_and_quote', () => {
    expect(
      deriveSourceChainStatus({ url: 'https://example.com', quote: 'verbatim text' }),
    ).toBe('source_and_quote');
  });

  test('sourceText + quote → source_and_quote', () => {
    expect(
      deriveSourceChainStatus({ sourceText: 'Excerpt', quote: 'verbatim text' }),
    ).toBe('source_and_quote');
  });

  test('url + sourceText + quote → source_and_quote', () => {
    expect(
      deriveSourceChainStatus({
        url: 'https://example.com',
        sourceText: 'Excerpt',
        quote: 'verbatim text',
      }),
    ).toBe('source_and_quote');
  });

  test('quote only (no source pointer) → unverified', () => {
    expect(deriveSourceChainStatus({ quote: 'verbatim text' })).toBe('unverified');
  });

  test('whitespace-only fields are treated as absent', () => {
    expect(deriveSourceChainStatus({ url: '   ', sourceText: '\n\t', quote: '' })).toBe(
      'unverified',
    );
    expect(deriveSourceChainStatus({ url: '   ', sourceText: '   ', quote: 'real quote' })).toBe(
      'unverified',
    );
  });

  test('null fields are treated as absent', () => {
    expect(deriveSourceChainStatus({ url: null, sourceText: null, quote: 'q' })).toBe(
      'unverified',
    );
  });

  test('deriveSourceChainStatus never returns no_source across all populated combinations', () => {
    const combos: Array<Pick<EvidenceAttachmentInput, 'url' | 'sourceText' | 'quote'>> = [];
    const urlOpts: Array<string | undefined> = [undefined, 'https://example.com'];
    const stOpts: Array<string | undefined> = [undefined, 'excerpt'];
    const qOpts: Array<string | undefined> = [undefined, 'quote'];
    for (const u of urlOpts) {
      for (const s of stOpts) {
        for (const q of qOpts) {
          if (u === undefined && s === undefined && q === undefined) continue;
          combos.push({ url: u, sourceText: s, quote: q });
        }
      }
    }
    expect(combos.length).toBeGreaterThan(0);
    for (const c of combos) {
      const status = deriveSourceChainStatus(c);
      expect(status).not.toBe('no_source');
      expect(status).not.toBe('broken');
      expect(status).not.toBe('primary_present');
      expect(
        (['unverified', 'source_no_quote', 'source_and_quote'] as SourceChainStatus[]).includes(
          status,
        ),
      ).toBe(true);
    }
  });
});

// ── classifyEvidenceKind ───────────────────────────────────────

describe('EV-001 — classifyEvidenceKind', () => {
  test('explicit kind always wins', () => {
    expect(
      classifyEvidenceKind({ kind: 'screenshot_redacted', url: 'https://example.com' }),
    ).toBe('screenshot_redacted');
    expect(classifyEvidenceKind({ kind: 'manual_citation' })).toBe('manual_citation');
  });

  test('dataset allowlist (data.gov, *.figshare.com, *.zenodo.org) → dataset', () => {
    expect(classifyEvidenceKind({ url: 'https://data.gov/some/page' })).toBe('dataset');
    expect(classifyEvidenceKind({ url: 'https://figshare.com/articles/X' })).toBe('dataset');
    expect(classifyEvidenceKind({ url: 'https://files.figshare.com/articles/X' })).toBe('dataset');
    expect(classifyEvidenceKind({ url: 'https://zenodo.org/record/123' })).toBe('dataset');
    expect(classifyEvidenceKind({ url: 'https://sub.zenodo.org/record/123' })).toBe('dataset');
  });

  test('non-allowlisted URL → url', () => {
    expect(classifyEvidenceKind({ url: 'https://example.com/article' })).toBe('url');
  });

  test('malformed URL → url (treated as opaque pointer)', () => {
    expect(classifyEvidenceKind({ url: 'not a real url' })).toBe('url');
  });

  test('sourceText only → source_text', () => {
    expect(classifyEvidenceKind({ sourceText: 'Excerpt' })).toBe('source_text');
  });

  test('quote only → source_text (downgraded; no source pointer)', () => {
    expect(classifyEvidenceKind({ quote: 'verbatim text' })).toBe('source_text');
  });

  test('all blank → manual_citation fallback (unreachable from adapter)', () => {
    expect(classifyEvidenceKind({})).toBe('manual_citation');
    expect(classifyEvidenceKind({ url: '', sourceText: '   ', quote: null })).toBe(
      'manual_citation',
    );
  });
});

// ── buildEvidenceArtifacts adapter ─────────────────────────────

describe('EV-001 — buildEvidenceArtifacts adapter', () => {
  test('empty input → []', () => {
    const out = buildEvidenceArtifacts({
      argumentId: ARG_ID,
      addedByUserId: USER_ID,
      createdAt: CREATED_AT,
      attachments: [],
    });
    expect(out).toEqual([]);
  });

  test('one URL attachment → one artifact, deterministic id, status source_no_quote', () => {
    const out = buildOne({ url: 'https://example.com/article' });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(`${ARG_ID}:evidence:0`);
    expect(out[0].kind).toBe('url');
    expect(out[0].sourceChainStatus).toBe('source_no_quote');
    expect(out[0].url).toBe('https://example.com/article');
    expect(out[0].argumentId).toBe(ARG_ID);
    expect(out[0].addedByUserId).toBe(USER_ID);
    expect(out[0].createdAt).toBe(CREATED_AT);
    expect(out[0].risk).toBe('unknown');
  });

  test('all-blank attachment is dropped; next index is preserved (stability promise)', () => {
    const out = buildEvidenceArtifacts({
      argumentId: ARG_ID,
      addedByUserId: USER_ID,
      createdAt: CREATED_AT,
      attachments: [
        { url: '   ', sourceText: '', quote: null },
        { url: 'https://example.com/two' },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(`${ARG_ID}:evidence:1`);
  });

  test('three attachments → three artifacts with indices 0/1/2', () => {
    const out = buildEvidenceArtifacts({
      argumentId: ARG_ID,
      addedByUserId: USER_ID,
      createdAt: CREATED_AT,
      attachments: [
        { url: 'https://a.example.com' },
        { sourceText: 'Excerpt B' },
        { url: 'https://c.example.com', quote: 'verbatim C' },
      ],
    });
    expect(out.map((a) => a.id)).toEqual([
      `${ARG_ID}:evidence:0`,
      `${ARG_ID}:evidence:1`,
      `${ARG_ID}:evidence:2`,
    ]);
    expect(out[0].sourceChainStatus).toBe('source_no_quote');
    expect(out[1].sourceChainStatus).toBe('source_no_quote');
    expect(out[2].sourceChainStatus).toBe('source_and_quote');
  });

  test('overrides shallow-merge on the matched artifact id', () => {
    const targetId = `${ARG_ID}:evidence:1`;
    const out = buildEvidenceArtifacts({
      argumentId: ARG_ID,
      addedByUserId: USER_ID,
      createdAt: CREATED_AT,
      attachments: [
        { url: 'https://a.example.com' },
        { url: 'https://b.example.com', sourceText: 'Excerpt', quote: 'verbatim' },
      ],
      overrides: {
        [targetId]: { sourceChainStatus: 'broken', risk: 'high' },
      },
    });
    expect(out[1].sourceChainStatus).toBe('broken');
    expect(out[1].risk).toBe('high');
    // Other fields preserved.
    expect(out[1].url).toBe('https://b.example.com');
    expect(out[0].sourceChainStatus).toBe('source_no_quote');
    expect(out[0].risk).toBe('unknown');
  });

  test('overrides can promote to primary_present without changing populated fields', () => {
    const id = `${ARG_ID}:evidence:0`;
    const out = buildEvidenceArtifacts({
      argumentId: ARG_ID,
      addedByUserId: USER_ID,
      createdAt: CREATED_AT,
      attachments: [{ url: 'https://example.com', quote: 'verbatim' }],
      overrides: { [id]: { sourceChainStatus: 'primary_present' } },
    });
    expect(out[0].sourceChainStatus).toBe('primary_present');
  });

  test('label fallback chain: explicit → hostname → sourceText prefix → "Attached evidence"', () => {
    const explicit = buildOne({ url: 'https://example.com', label: 'My label' });
    expect(explicit[0].label).toBe('My label');

    const hostname = buildOne({ url: 'https://example.com/articles/123' });
    expect(hostname[0].label).toBe('example.com');

    const prefix = buildOne({
      sourceText: 'This is a long excerpt from the source material being cited here.',
    });
    expect(prefix[0].label.length).toBeLessThanOrEqual(32);
    expect(prefix[0].label.startsWith('This is a long excerpt')).toBe(true);

    const fallback = buildOne({ quote: 'verbatim text' });
    expect(fallback[0].label).toBe('Attached evidence');
  });

  test('label truncation at 120 chars adds ellipsis', () => {
    const longLabel = 'a'.repeat(200);
    const out = buildOne({ url: 'https://example.com', label: longLabel });
    expect(out[0].label.length).toBe(120);
    expect(out[0].label.endsWith('…')).toBe(true);
  });

  test('determinism: same input twice → deeply equal arrays', () => {
    const inp = {
      argumentId: ARG_ID,
      addedByUserId: USER_ID,
      createdAt: CREATED_AT,
      attachments: [
        { url: 'https://a.example.com' },
        { sourceText: 'Excerpt', quote: 'verbatim' },
      ],
    };
    const a = buildEvidenceArtifacts(inp);
    const b = buildEvidenceArtifacts(inp);
    expect(a).toEqual(b);
  });

  test('dataset URL drives kind = dataset; status from decision table', () => {
    const out = buildOne({ url: 'https://data.gov/dataset/abc' });
    expect(out[0].kind).toBe('dataset');
    expect(out[0].sourceChainStatus).toBe('source_no_quote');
  });

  test('explicit kind passthrough survives the adapter', () => {
    const out = buildOne({ kind: 'screenshot_redacted', sourceText: 'PII-stripped image alt' });
    expect(out[0].kind).toBe('screenshot_redacted');
  });

  test('label fallback falls through when URL has no parseable hostname', () => {
    // A non-URL string that survives isPresent() but fails URL parsing.
    const out = buildOne({ url: 'not a real url', sourceText: 'Short excerpt' });
    expect(out[0].label).toBe('Short excerpt');
  });

  test('trims whitespace on url / sourceText / quote when copied onto the artifact', () => {
    const out = buildOne({
      url: '  https://example.com  ',
      sourceText: '\n  Excerpt  \n',
      quote: ' verbatim ',
    });
    expect(out[0].url).toBe('https://example.com');
    expect(out[0].sourceText).toBe('Excerpt');
    expect(out[0].quote).toBe('verbatim');
  });
});

// ── summarizeArtifactsForReceiptChip ───────────────────────────

describe('EV-001 — summarizeArtifactsForReceiptChip', () => {
  test('empty array → no_source form (the aggregate-only state)', () => {
    const chip = summarizeArtifactsForReceiptChip([]);
    expect(chip.status).toBe('no_source');
    expect(chip.label).toBe('No source yet');
    expect(chip.tone).toBe('info');
    expect(chip.invitesFollowup).toBe(true);
    expect(chip.showsSourceChainPressure).toBe(true);
    expect(chip.count).toBe(0);
    expect(chip.kinds).toHaveLength(0);
  });

  test('single unverified → "Receipt attached"', () => {
    const chip = summarizeArtifactsForReceiptChip([fixtureArtifact('unverified')]);
    expect(chip.status).toBe('unverified');
    expect(chip.label).toBe('Receipt attached');
    expect(chip.tone).toBe('info');
    expect(chip.invitesFollowup).toBe(true);
  });

  test('single source_no_quote → "Source attached"', () => {
    const chip = summarizeArtifactsForReceiptChip([fixtureArtifact('source_no_quote')]);
    expect(chip.label).toBe('Source attached');
  });

  test('single source_and_quote → "Source and quote", tone neutral, no followup', () => {
    const chip = summarizeArtifactsForReceiptChip([fixtureArtifact('source_and_quote')]);
    expect(chip.label).toBe('Source and quote');
    expect(chip.tone).toBe('neutral');
    expect(chip.invitesFollowup).toBe(false);
    expect(chip.showsSourceChainPressure).toBe(false);
  });

  test('single primary_present → "Primary source"', () => {
    const chip = summarizeArtifactsForReceiptChip([fixtureArtifact('primary_present')]);
    expect(chip.label).toBe('Primary source');
    expect(chip.tone).toBe('neutral');
  });

  test('single broken → "Source trail is weak", tone attention', () => {
    const chip = summarizeArtifactsForReceiptChip([fixtureArtifact('broken')]);
    expect(chip.label).toBe('Source trail is weak');
    expect(chip.tone).toBe('attention');
    expect(chip.invitesFollowup).toBe(true);
  });

  test('multiple artifacts: worst status wins (broken > unverified > source_no_quote > source_and_quote > primary_present)', () => {
    const a = fixtureArtifact('source_and_quote');
    const b = fixtureArtifact('source_no_quote');
    const c = fixtureArtifact('unverified');
    const d = fixtureArtifact('broken');
    expect(summarizeArtifactsForReceiptChip([a, b, c, d]).status).toBe('broken');
    expect(summarizeArtifactsForReceiptChip([a, b, c]).status).toBe('unverified');
    expect(summarizeArtifactsForReceiptChip([a, b]).status).toBe('source_no_quote');
    expect(summarizeArtifactsForReceiptChip([a]).status).toBe('source_and_quote');
    expect(
      summarizeArtifactsForReceiptChip([fixtureArtifact('primary_present'), a]).status,
    ).toBe('source_and_quote');
    expect(summarizeArtifactsForReceiptChip([fixtureArtifact('primary_present')]).status).toBe(
      'primary_present',
    );
  });

  test('kinds is unique-preserving in encounter order; count reflects total', () => {
    const k1: EvidenceArtifact = { ...fixtureArtifact('source_no_quote'), kind: 'url' };
    const k2: EvidenceArtifact = {
      ...fixtureArtifact('source_no_quote'),
      kind: 'dataset',
      id: `${ARG_ID}:evidence:1`,
    };
    const k3: EvidenceArtifact = {
      ...fixtureArtifact('source_no_quote'),
      kind: 'url',
      id: `${ARG_ID}:evidence:2`,
    };
    const chip = summarizeArtifactsForReceiptChip([k1, k2, k3]);
    expect(chip.kinds).toEqual(['url', 'dataset']);
    expect(chip.count).toBe(3);
  });

  test('unknown status value on an artifact is skipped, never crashes', () => {
    // Force-cast to exercise the defensive guard.
    const weird: EvidenceArtifact = {
      ...fixtureArtifact('source_and_quote'),
      sourceChainStatus: 'no_source' as SourceChainStatus,
    };
    const chip = summarizeArtifactsForReceiptChip([weird, fixtureArtifact('unverified')]);
    expect(chip.status).toBe('unverified');
  });
});

// ── Receipt-chip + timeline ban-list ───────────────────────────

describe('EV-001 — receipt-chip + timeline ban-list', () => {
  function assertNoBanned(value: string): void {
    const lower = value.toLowerCase();
    for (const banned of BANNED_TOKENS) {
      if (lower.includes(banned)) {
        throw new Error(`Banned token "${banned}" appeared in: "${value}"`);
      }
    }
  }

  test('never emits verdict / person-label tokens in any receipt-chip strings', () => {
    for (const status of ALL_SOURCE_CHAIN_STATUSES) {
      const chip: ReceiptChipContract =
        status === 'no_source'
          ? summarizeArtifactsForReceiptChip([])
          : summarizeArtifactsForReceiptChip([fixtureArtifact(status)]);
      assertNoBanned(chip.label);
      assertNoBanned(chip.helper);
    }
    const empty = summarizeArtifactsForReceiptChip([]);
    assertNoBanned(empty.label);
    assertNoBanned(empty.helper);
  });

  test('never emits snake_case codes in receipt-chip user-facing strings', () => {
    for (const status of ALL_SOURCE_CHAIN_STATUSES) {
      const chip: ReceiptChipContract =
        status === 'no_source'
          ? summarizeArtifactsForReceiptChip([])
          : summarizeArtifactsForReceiptChip([fixtureArtifact(status)]);
      // A bare snake_case code looks like `^[a-z][a-z0-9_]{4,}$` and contains an underscore.
      expect(chip.label).not.toMatch(/^[a-z][a-z0-9_]{4,}$/);
      expect(chip.helper).not.toMatch(/_/);
    }
  });

  test('accessibility-label suffix is free of verdict tokens', () => {
    const argumentTypes: Array<string | undefined> = [
      'thesis',
      'claim',
      'rebuttal',
      'counter_rebuttal',
      'evidence',
      'clarification_request',
      'concession',
      'synthesis',
      undefined,
    ];
    for (const at of argumentTypes) {
      for (const status of ALL_SOURCE_CHAIN_STATUSES) {
        const artifacts: EvidenceArtifact[] =
          status === 'no_source' ? [] : [fixtureArtifact(status)];
        const contract = getTimelineEvidenceContract(at, artifacts);
        assertNoBanned(contract.accessibilityLabelSuffix);
        assertNoBanned(contract.receiptChip.label);
        assertNoBanned(contract.receiptChip.helper);
      }
    }
  });
});

// ── getTimelineEvidenceContract ────────────────────────────────

describe('EV-001 — getTimelineEvidenceContract', () => {
  test('argumentType="evidence", artifacts empty → evidence node + source-chain ring + no-source suffix', () => {
    const contract = getTimelineEvidenceContract('evidence', []);
    expect(contract.rendersAsEvidenceNode).toBe(true);
    expect(contract.rendersSourceChainRing).toBe(true);
    expect(contract.accessibilityLabelSuffix).toBe('Evidence node, no source yet.');
    expect(contract.receiptChip.status).toBe('no_source');
  });

  test('argumentType="rebuttal", artifacts non-empty unverified → no evidence node + ring + suffix mentions "Has attached receipt"', () => {
    const contract = getTimelineEvidenceContract('rebuttal', [fixtureArtifact('unverified')]);
    expect(contract.rendersAsEvidenceNode).toBe(false);
    expect(contract.rendersSourceChainRing).toBe(true);
    expect(contract.accessibilityLabelSuffix.toLowerCase()).toContain('has attached receipt');
  });

  test('argumentType="claim", artifacts empty → no decoration, empty suffix', () => {
    const contract = getTimelineEvidenceContract('claim', []);
    expect(contract.rendersAsEvidenceNode).toBe(false);
    expect(contract.rendersSourceChainRing).toBe(false);
    expect(contract.accessibilityLabelSuffix).toBe('');
    expect(contract.receiptChip.status).toBe('no_source');
  });

  test('argumentType="evidence", artifacts source_and_quote → evidence node, no ring, source-and-quote suffix', () => {
    const contract = getTimelineEvidenceContract('evidence', [fixtureArtifact('source_and_quote')]);
    expect(contract.rendersAsEvidenceNode).toBe(true);
    expect(contract.rendersSourceChainRing).toBe(false);
    expect(contract.accessibilityLabelSuffix).toBe(
      'Evidence node, source and quote attached.',
    );
  });

  test('argumentType="evidence", artifacts primary_present → evidence node, no ring, primary suffix', () => {
    const contract = getTimelineEvidenceContract('evidence', [
      fixtureArtifact('primary_present'),
    ]);
    expect(contract.rendersAsEvidenceNode).toBe(true);
    expect(contract.rendersSourceChainRing).toBe(false);
    expect(contract.accessibilityLabelSuffix).toBe('Evidence node, primary source attached.');
  });

  test('argumentType="evidence", artifacts broken → evidence node, ring, falls back to chip-label suffix', () => {
    const contract = getTimelineEvidenceContract('evidence', [fixtureArtifact('broken')]);
    expect(contract.rendersAsEvidenceNode).toBe(true);
    expect(contract.rendersSourceChainRing).toBe(true);
    expect(contract.accessibilityLabelSuffix.toLowerCase()).toContain('evidence node,');
    expect(contract.accessibilityLabelSuffix.toLowerCase()).toContain('source trail is weak');
  });

  test('argumentType undefined → treated as not-evidence', () => {
    const contract = getTimelineEvidenceContract(undefined, []);
    expect(contract.rendersAsEvidenceNode).toBe(false);
    expect(contract.rendersSourceChainRing).toBe(false);
    expect(contract.accessibilityLabelSuffix).toBe('');
  });

  test('argumentType null → treated as not-evidence', () => {
    const contract = getTimelineEvidenceContract(null, [fixtureArtifact('unverified')]);
    expect(contract.rendersAsEvidenceNode).toBe(false);
    // Non-evidence node with artifacts still shows source-chain ring when the chip warrants it.
    expect(contract.rendersSourceChainRing).toBe(true);
  });
});

// ── Doctrine anchor — missing evidence does NOT block ordinary replies ──

describe('EV-001 — doctrine anchor (missing evidence does NOT block ordinary replies)', () => {
  const RESOLUTION = 'Universal basic income reduces long-term poverty.';
  const DESCRIPTION = 'A debate on UBI as a poverty-reduction mechanism.';

  function makeInput(
    overrides: Partial<ArgumentDraftEvaluationInput>,
  ): ArgumentDraftEvaluationInput {
    return {
      debateId: 'debate-ev001',
      debateResolution: RESOLUTION,
      debateDescription: DESCRIPTION,
      parentArgument: {
        id: 'p1',
        argumentType: 'thesis',
        side: 'affirmative',
        body: 'Universal basic income reduces poverty by providing a stable income floor.',
        depth: 0,
      },
      argumentType: 'rebuttal',
      side: 'negative',
      body: 'Universal basic income does not reduce poverty because labor supply effects undermine the income floor and erode the long-term mechanism.',
      selectedTagCodes: [],
      activeConstitution: constitutionVersion,
      activeRules: constitutionRules,
      tagDefinitions,
      flagDefinitions,
      ...overrides,
    };
  }

  test('ordinary rebuttal without evidence remains postable; no evidence_required flag', () => {
    const result = evaluateArgumentDraft(makeInput({}));
    expect(result.allowPost).toBe(true);
    const evidenceFlags = [...result.blockingErrors, ...result.warnings].filter(
      (f) => f.flagCode === 'evidence_required',
    );
    expect(evidenceFlags).toHaveLength(0);
    const persistedEvidence = result.flagsToPersist.filter(
      (f) => f.flagCode === 'evidence_required',
    );
    expect(persistedEvidence).toHaveLength(0);
  });

  test('explicit evidence-type post without artifacts is blocked by EVIDENCE_SOURCE_REQUIRED', () => {
    const result = evaluateArgumentDraft(
      makeInput({
        argumentType: 'evidence',
        parentArgument: {
          id: 'p1',
          argumentType: 'claim',
          side: 'affirmative',
          body: 'UBI reduces poverty.',
          depth: 1,
        },
        body: 'Stockton SEED pilot showed a meaningful employment effect among UBI recipients in the long-term poverty mechanism.',
      }),
    );
    expect(result.allowPost).toBe(false);
    expect(
      result.blockingErrors.some((e) => e.flagCode === 'evidence_required'),
    ).toBe(true);
  });

  test('explicit evidence-type post WITH an artifact (URL) is not blocked by evidence_required', () => {
    const result = evaluateArgumentDraft(
      makeInput({
        argumentType: 'evidence',
        parentArgument: {
          id: 'p1',
          argumentType: 'claim',
          side: 'affirmative',
          body: 'UBI reduces poverty.',
          depth: 1,
        },
        body: 'Stockton SEED pilot showed a meaningful employment effect among UBI recipients in the long-term poverty mechanism.',
        attachedEvidence: [{ url: 'https://example.com/seed', label: 'SEED pilot' }],
      }),
    );
    expect(result.blockingErrors.some((e) => e.flagCode === 'evidence_required')).toBe(false);
  });

  test('reply tagged with evidence tag and no source is blocked (parity with explicit evidence type)', () => {
    const result = evaluateArgumentDraft(
      makeInput({
        argumentType: 'rebuttal',
        selectedTagCodes: ['evidence'],
      }),
    );
    expect(result.allowPost).toBe(false);
    expect(result.blockingErrors.some((e) => e.flagCode === 'evidence_required')).toBe(true);
  });
});

// ── Risk default + override interop ───────────────────────────

describe('EV-001 — risk defaults + override interop', () => {
  test('default risk is "unknown" on every adapter-produced artifact', () => {
    const out = buildEvidenceArtifacts({
      argumentId: ARG_ID,
      addedByUserId: USER_ID,
      createdAt: CREATED_AT,
      attachments: [
        { url: 'https://example.com' },
        { sourceText: 'Excerpt', quote: 'verbatim' },
      ],
    });
    for (const a of out) {
      const r: EvidenceRisk = a.risk;
      expect(r).toBe('unknown');
    }
  });

  test('override risk = "high" is applied after derivation', () => {
    const id = `${ARG_ID}:evidence:0`;
    const out = buildEvidenceArtifacts({
      argumentId: ARG_ID,
      addedByUserId: USER_ID,
      createdAt: CREATED_AT,
      attachments: [{ url: 'https://example.com' }],
      overrides: { [id]: { risk: 'high' } },
    });
    expect(out[0].risk).toBe('high');
  });
});

// ── Index barrel ───────────────────────────────────────────────

describe('EV-001 — index barrel re-exports', () => {
  test('typed identifiers reach the barrel', () => {
    // Compile-time check: assigning a barrel-imported kind to the local type works.
    const k: EvidenceArtifactKind = 'url';
    const s: SourceChainStatus = 'no_source';
    const r: EvidenceRisk = 'unknown';
    expect(k).toBe('url');
    expect(s).toBe('no_source');
    expect(r).toBe('unknown');
  });
});
