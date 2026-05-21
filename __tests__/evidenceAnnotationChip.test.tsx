/**
 * EV-005 — EvidenceAnnotationChip + EvidenceAnnotationStream tests.
 *
 * The repo's UI test discipline is pure-helper + source-scan (the pinned
 * react-test-renderer is held away from @testing-library's peer — see
 * ReceiptChip.test.tsx / chimeInGovernanceControl.test.tsx). The chip's
 * load-bearing render decisions are extracted into pure helpers
 * (buildAnnotationChipLabel / buildAnnotationChipAccessibilityLabel /
 * buildAnnotationStatusChipAccessibilityLabel) and exercised here; the
 * component contract (roles, hit targets, observer variant, color
 * independence) is asserted by a source-scan.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  buildAnnotationChipAccessibilityLabel,
  buildAnnotationChipLabel,
  buildAnnotationStatusChipAccessibilityLabel,
  EVIDENCE_ANNOTATION_OBSERVER_HELPER,
} from '../src/features/evidence/EvidenceAnnotationChip';
import {
  ALL_EVIDENCE_ANNOTATION_KINDS,
  buildEvidenceAnnotation,
  getEvidenceAnnotationLabel,
  summariseAnnotations,
  type EvidenceAnnotation,
  type EvidenceAnnotationKind,
} from '../src/features/evidence/evidenceModel';

const ARTIFACT_ID = 'arg-1:evidence:0';

function ann(
  kind: EvidenceAnnotationKind,
  index = 0,
  opts: { depth?: 0 | 1; note?: string | null; parentAnnotationId?: string | null } = {},
): EvidenceAnnotation {
  return buildEvidenceAnnotation({
    evidenceArtifactId: ARTIFACT_ID,
    kind,
    addedByUserId: 'u',
    createdAt: '2026-05-20T00:00:00.000Z',
    index,
    note: opts.note ?? null,
    depth: opts.depth ?? 0,
    parentAnnotationId: opts.parentAnnotationId ?? null,
  });
}

// ── buildAnnotationChipLabel ──────────────────────────────────

describe('buildAnnotationChipLabel', () => {
  it('renders the plain-language label for every kind (no raw code)', () => {
    for (const kind of ALL_EVIDENCE_ANNOTATION_KINDS) {
      const label = buildAnnotationChipLabel(ann(kind));
      expect(label).toContain(getEvidenceAnnotationLabel(kind));
      expect(label).not.toMatch(/_/);
    }
  });

  it('appends a short note suffix when a note is present', () => {
    const label = buildAnnotationChipLabel(ann('context_requested', 0, { note: 'need the report' }));
    expect(label).toContain('More context asked for');
    expect(label).toContain('need the report');
  });

  it('truncates a long note in the chip label', () => {
    const label = buildAnnotationChipLabel(
      ann('context_requested', 0, { note: 'x'.repeat(120) }),
    );
    expect(label).toContain('…');
  });
});

// ── accessibility labels ──────────────────────────────────────

describe('buildAnnotationChipAccessibilityLabel', () => {
  it('carries the kind label + helper', () => {
    const label = buildAnnotationChipAccessibilityLabel(ann('primary_source'));
    expect(label).toContain('Primary source');
    expect(label).toContain('original record');
  });

  it('marks a depth-1 annotation as a reply annotation', () => {
    const label = buildAnnotationChipAccessibilityLabel(
      ann('context_requested', 1, { depth: 1, parentAnnotationId: `${ARTIFACT_ID}:annotation:0` }),
    );
    expect(label).toContain('Reply annotation');
  });

  it('includes the note text when present', () => {
    const label = buildAnnotationChipAccessibilityLabel(
      ann('context_requested', 0, { note: 'where is the dataset' }),
    );
    expect(label).toContain('where is the dataset');
  });
});

describe('buildAnnotationStatusChipAccessibilityLabel', () => {
  it('carries the status label + count for a populated summary', () => {
    const summary = summariseAnnotations([ann('primary_source', 0), ann('broken_link', 1)]);
    const label = buildAnnotationStatusChipAccessibilityLabel(summary);
    expect(label).toContain(summary.statusLabel);
    expect(label).toContain('2 annotations');
  });

  it('says "No annotations" for an empty summary', () => {
    const summary = summariseAnnotations([]);
    const label = buildAnnotationStatusChipAccessibilityLabel(summary);
    expect(label).toContain('No annotations');
  });

  it('uses the singular form for a single annotation', () => {
    const summary = summariseAnnotations([ann('primary_source')]);
    expect(buildAnnotationStatusChipAccessibilityLabel(summary)).toContain('1 annotation.');
  });
});

// ── Grayscale / color-independence check ──────────────────────

describe('color independence', () => {
  it('every chip label is fully legible without color (text carries meaning)', () => {
    for (const kind of ALL_EVIDENCE_ANNOTATION_KINDS) {
      // The chip text alone distinguishes the kind — no reliance on tone color.
      const label = buildAnnotationChipLabel(ann(kind));
      expect(label.length).toBeGreaterThan(0);
    }
    // No two kinds share the same label.
    const labels = ALL_EVIDENCE_ANNOTATION_KINDS.map((k) => getEvidenceAnnotationLabel(k));
    expect(new Set(labels).size).toBe(labels.length);
  });
});

// ── Component contract — source scan ──────────────────────────

describe('EvidenceAnnotationChip.tsx — component contract', () => {
  const src = fs.readFileSync(
    path.join(process.cwd(), 'src/features/evidence/EvidenceAnnotationChip.tsx'),
    'utf8',
  );

  it('chips are accessibilityRole="text" (read-only, not pressable in v1)', () => {
    expect(src).toMatch(/accessibilityRole="text"/);
  });

  it('the "Add an annotation" trigger is a button with a 44-or-greater hit target', () => {
    expect(src).toMatch(/add-annotation-trigger-/);
    expect(src).toMatch(/accessibilityRole="button"/);
    expect(src).toMatch(/STREAM_HIT_SLOP/);
    expect(src).toMatch(/top: 12, bottom: 12, left: 12, right: 12/);
  });

  it('hides the trigger for an ineligible viewer (canAddAnnotation false)', () => {
    expect(src).toMatch(/canAddAnnotation && !isReadModeViewer/);
  });

  it('renders the synthesis-prompt row as a button when not in read mode', () => {
    expect(src).toMatch(/depthCap\.showsSynthesisPrompt/);
    expect(src).toMatch(/onPressSynthesisPrompt/);
    expect(src).toMatch(/annotation-synthesis-prompt-/);
  });

  it('renders the synthesis prompt + trigger disabled with the observer helper', () => {
    expect(src).toMatch(/EVIDENCE_ANNOTATION_OBSERVER_HELPER/);
    expect(src).toMatch(/accessibilityState=\{\{ disabled: true \}\}/);
  });

  it('the status-chip header exposes the count in its a11y label', () => {
    expect(src).toMatch(/buildAnnotationStatusChipAccessibilityLabel/);
    expect(src).toMatch(/annotation-status-chip-/);
  });

  it('every rendered label is wrapped in a <Text> element', () => {
    // Each visible string (statusLabel / statusHelper / chip label / trigger
    // / synthesis prompt / observer helper) is rendered through a <Text>.
    const textOpens = (src.match(/<Text\b/g) || []).length;
    expect(textOpens).toBeGreaterThanOrEqual(8);
  });

  it('imports no Supabase / network module', () => {
    const importLines = src.split('\n').filter((l) => /^\s*import\s/.test(l));
    for (const line of importLines) {
      expect(line).not.toMatch(/@supabase/);
    }
    expect(src).not.toMatch(/\bfetch\(/);
  });

  it('the observer helper is non-empty and ban-list-clean of verdict tokens', () => {
    expect(EVIDENCE_ANNOTATION_OBSERVER_HELPER.length).toBeGreaterThan(0);
    for (const t of ['winner', 'loser', 'liar', 'true', 'false', 'verdict']) {
      expect(EVIDENCE_ANNOTATION_OBSERVER_HELPER.toLowerCase()).not.toContain(t);
    }
  });
});
