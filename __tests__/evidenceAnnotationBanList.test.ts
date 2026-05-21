/**
 * EV-005 — Annotation ban-list doctrine tests.
 *
 * Scans every app-authored annotation string the model can emit — all 18
 * kind labels, all 18 helpers, all 6 status labels, all 6 status helpers,
 * the synthesis-prompt label, and the picker copy strings — against three
 * ban-lists: verdict tokens, amplification tokens, and person-attribution
 * tokens. The three accusation-adjacent kinds (misreporting_alleged /
 * quote_disputed / methodology_dispute) get special focus: their copy must
 * read as record-descriptive, never as "lied / deceived / misleading reader".
 */
import {
  ALL_EVIDENCE_ANNOTATION_KINDS,
  ANNOTATION_SYNTHESIS_PROMPT_LABEL,
  buildEvidenceAnnotation,
  getEvidenceAnnotationHelper,
  getEvidenceAnnotationLabel,
  summariseAnnotations,
  _forbiddenAnnotationTokens,
  type EvidenceAnnotationKind,
  type EvidenceAnnotationStatusChip,
} from '../src/features/evidence/evidenceModel';
import {
  buildAnnotationChipAccessibilityLabel,
  buildAnnotationChipLabel,
  buildAnnotationStatusChipAccessibilityLabel,
  EVIDENCE_ANNOTATION_OBSERVER_HELPER,
} from '../src/features/evidence/EvidenceAnnotationChip';
import {
  ADD_ANNOTATION_NOTE_HINT,
  ADD_ANNOTATION_NOTE_LABEL,
} from '../src/features/evidence/AddAnnotationSheet';

// ── Ban-list groups ───────────────────────────────────────────

const VERDICT_TOKENS = [
  'winner',
  'loser',
  'correct',
  'incorrect',
  'liar',
  'dishonest',
  'fake',
  'fraud',
  'hoax',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'troll',
  'astroturfer',
  'proof',
  'proven',
  'verdict',
  'won',
  'lost',
  'defeated',
  'right',
  'wrong',
];

const AMPLIFICATION_TOKENS = [
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
  'viral',
  'popular',
];

const PERSON_ATTRIBUTION_TOKENS = [
  'lied',
  'deceived',
  'misleading reader',
  'liar',
  'dishonest',
  'bad faith',
];

// ── The full set of app-authored strings ──────────────────────

function allAnnotationStrings(): string[] {
  const out: string[] = [];

  // 18 kind labels + 18 helpers.
  for (const kind of ALL_EVIDENCE_ANNOTATION_KINDS) {
    out.push(getEvidenceAnnotationLabel(kind));
    out.push(getEvidenceAnnotationHelper(kind));
  }

  // 6 status labels + 6 status helpers — reach every chip via summariseAnnotations.
  const statusFixtures: Array<{ chip: EvidenceAnnotationStatusChip; kind: EvidenceAnnotationKind }> = [
    { chip: 'unknown', kind: 'quote_attached' },
    { chip: 'anchored', kind: 'primary_source' },
    { chip: 'conflict_open', kind: 'conflicting_source' },
    { chip: 'context_open', kind: 'context_requested' },
    { chip: 'broken', kind: 'broken_link' },
    { chip: 'paywalled', kind: 'paywalled_source' },
  ];
  for (const f of statusFixtures) {
    const summary = summariseAnnotations(
      f.chip === 'unknown'
        ? []
        : [
            buildEvidenceAnnotation({
              evidenceArtifactId: 'a:evidence:0',
              kind: f.kind,
              addedByUserId: 'u',
              createdAt: '2026-05-20T00:00:00.000Z',
              index: 0,
            }),
          ],
    );
    out.push(summary.statusLabel);
    out.push(summary.statusHelper);
  }

  // The synthesis-prompt label.
  out.push(ANNOTATION_SYNTHESIS_PROMPT_LABEL);

  // Picker copy strings.
  out.push('Add an annotation');
  out.push(ADD_ANNOTATION_NOTE_HINT);
  out.push(ADD_ANNOTATION_NOTE_LABEL);
  out.push(EVIDENCE_ANNOTATION_OBSERVER_HELPER);

  return out;
}

function scanWholeWord(strings: string[], tokens: string[]): { str: string; token: string } | null {
  for (const str of strings) {
    const lower = str.toLowerCase();
    for (const token of tokens) {
      const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(lower)) return { str, token };
    }
  }
  return null;
}

// ── Verdict ban-list ──────────────────────────────────────────

describe('EV-005 ban-list — verdict tokens', () => {
  it('no app-authored annotation string carries a verdict token', () => {
    const hit = scanWholeWord(allAnnotationStrings(), VERDICT_TOKENS);
    expect(hit).toBeNull();
  });
});

// ── Amplification ban-list ────────────────────────────────────

describe('EV-005 ban-list — amplification tokens', () => {
  it('no app-authored annotation string references popularity / engagement', () => {
    const hit = scanWholeWord(allAnnotationStrings(), AMPLIFICATION_TOKENS);
    expect(hit).toBeNull();
  });
});

// ── Person-attribution ban-list ───────────────────────────────

describe('EV-005 ban-list — person-attribution tokens', () => {
  it('no app-authored annotation string accuses a person', () => {
    const hit = scanWholeWord(allAnnotationStrings(), PERSON_ATTRIBUTION_TOKENS);
    expect(hit).toBeNull();
  });

  it('the 3 accusation-adjacent kinds read as record-descriptive', () => {
    const focus: EvidenceAnnotationKind[] = [
      'misreporting_alleged',
      'quote_disputed',
      'methodology_dispute',
    ];
    for (const kind of focus) {
      const label = getEvidenceAnnotationLabel(kind).toLowerCase();
      const helper = getEvidenceAnnotationHelper(kind).toLowerCase();
      for (const token of PERSON_ATTRIBUTION_TOKENS) {
        expect(label).not.toContain(token);
        expect(helper).not.toContain(token);
      }
    }
    // The locked record-descriptive label for misreporting_alleged.
    expect(getEvidenceAnnotationLabel('misreporting_alleged')).toBe('An alternate account exists');
  });
});

// ── Ban-list seam guard ───────────────────────────────────────

describe('EV-005 ban-list — _forbiddenAnnotationTokens seam', () => {
  it('_forbiddenAnnotationTokens is non-empty', () => {
    expect(_forbiddenAnnotationTokens().length).toBeGreaterThan(0);
  });

  it('the scan actually iterates the seam (guards an empty-list false pass)', () => {
    let iterated = 0;
    const tokens = _forbiddenAnnotationTokens();
    for (const token of tokens) {
      iterated += 1;
      // Every seam token is a real lower-case string.
      expect(typeof token).toBe('string');
      expect(token).toBe(token.toLowerCase());
    }
    expect(iterated).toBe(tokens.length);
    expect(iterated).toBeGreaterThan(20);
  });

  it('every app-authored string is clean against the full seam list', () => {
    const hit = scanWholeWord(allAnnotationStrings(), [..._forbiddenAnnotationTokens()]);
    expect(hit).toBeNull();
  });
});

// ── Rendered helper strings ───────────────────────────────────

describe('EV-005 ban-list — rendered chip / stream helper output', () => {
  it('every chip label + a11y label for every kind is ban-list-clean', () => {
    const strings: string[] = [];
    for (const kind of ALL_EVIDENCE_ANNOTATION_KINDS) {
      const a = buildEvidenceAnnotation({
        evidenceArtifactId: 'a:evidence:0',
        kind,
        addedByUserId: 'u',
        createdAt: '2026-05-20T00:00:00.000Z',
        index: 0,
      });
      strings.push(buildAnnotationChipLabel(a));
      strings.push(buildAnnotationChipAccessibilityLabel(a));
    }
    const all = [...VERDICT_TOKENS, ...AMPLIFICATION_TOKENS, ...PERSON_ATTRIBUTION_TOKENS];
    expect(scanWholeWord(strings, all)).toBeNull();
  });

  it('the status-chip a11y label for every chip value is ban-list-clean', () => {
    const fixtures: Array<EvidenceAnnotationKind | null> = [
      null,
      'primary_source',
      'conflicting_source',
      'context_requested',
      'broken_link',
      'paywalled_source',
    ];
    const strings = fixtures.map((kind) =>
      buildAnnotationStatusChipAccessibilityLabel(
        summariseAnnotations(
          kind === null
            ? []
            : [
                buildEvidenceAnnotation({
                  evidenceArtifactId: 'a:evidence:0',
                  kind,
                  addedByUserId: 'u',
                  createdAt: '2026-05-20T00:00:00.000Z',
                  index: 0,
                }),
              ],
        ),
      ),
    );
    const all = [...VERDICT_TOKENS, ...AMPLIFICATION_TOKENS, ...PERSON_ATTRIBUTION_TOKENS];
    expect(scanWholeWord(strings, all)).toBeNull();
  });
});
