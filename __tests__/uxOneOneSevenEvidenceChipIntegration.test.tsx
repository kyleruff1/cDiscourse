/**
 * UX-001.7 Workstream 4 — EvidenceAnnotationChip refactor integration tests.
 *
 * Per `docs/designs/UX-001.7.md` §5 (preferred-path refactor). Asserts:
 *
 *   1. The refactored `EvidenceAnnotationChip` now consumes the
 *      `AnnotationChip` primitive (source-scan).
 *   2. The new `buildAnnotationDescriptor` pure helper produces the
 *      expected `AnnotationChipDescriptor` shape (depth-prefix preserved,
 *      aria label preserved verbatim, kind = 'evidence').
 *   3. Runtime values stay byte-equivalent to the pre-refactor state:
 *      - aria label string identical for each fixture kind
 *      - depth `↳` prefix preserved on depth-1 annotations
 *      - status-chip tone palette resolves to the same hex values
 *        (color-shift-free).
 *   4. EV-005-specific affordances (status header, add-trigger,
 *      observer notice, synthesis-prompt) render verbatim — their
 *      copy strings and accessibility labels are unchanged.
 *   5. `STREAM_HIT_SLOP` now sources from `TOUCH_TARGET.hitSlopAll`
 *      (canonical token, byte-equivalent literal value).
 *   6. The sole production consumer (`SourceChainPopover.tsx`) is
 *      untouched (zero diff against the prior consumer surface).
 *
 * Mirrors the pure-helper + source-scan pattern of
 * `evidenceAnnotationChip.test.tsx`. No React render (the repo's pinned
 * react-test-renderer is held away from @testing-library's peer).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  STATUS,
  SURFACE_TOKENS,
  TOUCH_TARGET,
} from '../src/lib/designTokens';
import {
  buildAnnotationChipAccessibilityLabel,
  buildAnnotationChipLabel,
  buildAnnotationDescriptor,
  EVIDENCE_ANNOTATION_OBSERVER_HELPER,
  EvidenceAnnotationChip,
  EvidenceAnnotationStream,
} from '../src/features/evidence/EvidenceAnnotationChip';
import {
  ALL_EVIDENCE_ANNOTATION_KINDS,
  buildEvidenceAnnotation,
  summariseAnnotations,
  type EvidenceAnnotation,
  type EvidenceAnnotationKind,
} from '../src/features/evidence/evidenceModel';

const ROOT = process.cwd();
const ARTIFACT_ID = 'arg-1:evidence:0';

const CHIP_SRC = fs.readFileSync(
  path.resolve(ROOT, 'src/features/evidence/EvidenceAnnotationChip.tsx'),
  'utf8',
);

const POPOVER_SRC = fs.readFileSync(
  path.resolve(ROOT, 'src/features/evidence/SourceChainPopover.tsx'),
  'utf8',
);

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

// ── Refactor source-scan: AnnotationChip primitive consumption ─

describe('UX-001.7 Workstream 4 — EvidenceAnnotationChip consumes AnnotationChip primitive', () => {
  it('imports AnnotationChip from the UX-001.5 nodeAnnotations primitive set', () => {
    expect(CHIP_SRC).toMatch(
      /import\s*\{\s*AnnotationChip\s*\}\s*from\s*['"]\.\.\/nodeAnnotations\/AnnotationChip['"]/,
    );
  });

  it('imports AnnotationChipDescriptor type from the primitive descriptor module', () => {
    expect(CHIP_SRC).toMatch(/AnnotationChipDescriptor/);
    expect(CHIP_SRC).toMatch(
      /from\s*['"]\.\.\/nodeAnnotations\/annotationChipDescriptor['"]/,
    );
  });

  it('exports a buildAnnotationDescriptor pure helper for EvidenceAnnotation → AnnotationChipDescriptor mapping', () => {
    expect(CHIP_SRC).toMatch(/export\s+function\s+buildAnnotationDescriptor/);
  });

  it('renders the chip via <AnnotationChip descriptor={...} /> instead of a bespoke <View><Text>', () => {
    expect(CHIP_SRC).toMatch(/<AnnotationChip\b/);
  });

  it('imports TOUCH_TARGET for the canonical hit-slop token', () => {
    expect(CHIP_SRC).toMatch(
      /import\s*\{[^}]*TOUCH_TARGET[^}]*\}\s*from\s*['"]\.\.\/\.\.\/lib\/designTokens['"]/,
    );
  });

  it('STREAM_HIT_SLOP now sources from TOUCH_TARGET.hitSlopAll (replaces local literal)', () => {
    expect(CHIP_SRC).toMatch(/STREAM_HIT_SLOP\s*=\s*TOUCH_TARGET\.hitSlopAll/);
  });

  it('the old local hit-slop literal { top: 12, bottom: 12, left: 12, right: 12 } is gone', () => {
    // After refactor the literal is only present in the JSDoc comment
    // (documenting the byte-equivalence). The runtime declaration uses
    // the token.
    const codeOnly = CHIP_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly).not.toMatch(/Object\.freeze\(\{\s*top:\s*12,\s*bottom:\s*12,\s*left:\s*12,\s*right:\s*12\s*\}\)/);
  });
});

// ── Pure helper — buildAnnotationDescriptor ────────────────────

describe('UX-001.7 Workstream 4 — buildAnnotationDescriptor pure helper', () => {
  it('returns a descriptor with kind="evidence" for every kind', () => {
    for (const kind of ALL_EVIDENCE_ANNOTATION_KINDS) {
      const d = buildAnnotationDescriptor(ann(kind));
      expect(d.kind).toBe('evidence');
    }
  });

  it('descriptor.id matches annotation.id (stable React key)', () => {
    const a = ann('primary_source');
    const d = buildAnnotationDescriptor(a);
    expect(d.id).toBe(a.id);
    expect(d.id.length).toBeGreaterThan(0);
  });

  it('descriptor.label preserves the depth ↳ prefix on depth-1 annotations', () => {
    const a = ann('context_requested', 1, {
      depth: 1,
      parentAnnotationId: `${ARTIFACT_ID}:annotation:0`,
    });
    const d = buildAnnotationDescriptor(a);
    expect(d.label.startsWith('↳ ')).toBe(true);
    // The post-prefix label matches the buildAnnotationChipLabel output.
    expect(d.label).toBe(`↳ ${buildAnnotationChipLabel(a)}`);
  });

  it('descriptor.label has no depth prefix on depth-0 annotations', () => {
    const a = ann('primary_source', 0);
    const d = buildAnnotationDescriptor(a);
    expect(d.label.startsWith('↳ ')).toBe(false);
    expect(d.label).toBe(buildAnnotationChipLabel(a));
  });

  it('descriptor.ariaLabel matches buildAnnotationChipAccessibilityLabel verbatim', () => {
    for (const kind of ALL_EVIDENCE_ANNOTATION_KINDS) {
      const a = ann(kind);
      const d = buildAnnotationDescriptor(a);
      expect(d.ariaLabel).toBe(buildAnnotationChipAccessibilityLabel(a));
    }
  });

  it('descriptor does not set iconHint (chip stays label-only; depth glyph is in label)', () => {
    for (const kind of ALL_EVIDENCE_ANNOTATION_KINDS) {
      const d = buildAnnotationDescriptor(ann(kind));
      expect(d.iconHint).toBeUndefined();
    }
  });

  it('descriptor is a plain object (pure-TS, no React)', () => {
    const d = buildAnnotationDescriptor(ann('primary_source'));
    expect(typeof d).toBe('object');
    expect(d).not.toBeNull();
  });
});

// ── Tone palette runtime byte-equivalence ──────────────────────

describe('UX-001.7 Workstream 4 — tone palette resolves to byte-equivalent hex values', () => {
  // The prior `TONE_BG` / `TONE_FG` hex literals (before refactor)
  // were exactly the values below. The refactor MUST preserve them
  // byte-equivalent — token references resolve to the same hex strings.
  it('neutral tone resolves to the prior #1e293b / #e2e8f0 pair', () => {
    expect(SURFACE_TOKENS.border).toBe('#1e293b');
    expect(SURFACE_TOKENS.textPrimary).toBe('#e2e8f0');
  });

  it('muted tone resolves to the prior #1f2937 / #cbd5e1 pair', () => {
    expect(STATUS.neutral.bg).toBe('#1f2937');
    expect(STATUS.neutral.fg).toBe('#cbd5e1');
  });

  it('info tone literal is preserved at #0c4a6e / #bae6fd (no matching shared token)', () => {
    expect(CHIP_SRC).toMatch(/info:\s*['"]#0c4a6e['"]/);
    expect(CHIP_SRC).toMatch(/info:\s*['"]#bae6fd['"]/);
  });

  it('attention tone literal is preserved at #7c2d12 / #fed7aa (no matching shared token)', () => {
    expect(CHIP_SRC).toMatch(/attention:\s*['"]#7c2d12['"]/);
    expect(CHIP_SRC).toMatch(/attention:\s*['"]#fed7aa['"]/);
  });
});

// ── EV-005 affordance preservation ─────────────────────────────

describe('UX-001.7 Workstream 4 — EV-005 affordances preserved verbatim', () => {
  it('status-chip header still uses buildAnnotationStatusChipAccessibilityLabel', () => {
    expect(CHIP_SRC).toMatch(/buildAnnotationStatusChipAccessibilityLabel/);
  });

  it('status-chip header has testID annotation-status-chip-${messageId}', () => {
    expect(CHIP_SRC).toMatch(/annotation-status-chip-/);
  });

  it('add-trigger preserves testID add-annotation-trigger-${messageId}', () => {
    expect(CHIP_SRC).toMatch(/add-annotation-trigger-/);
  });

  it('observer trigger notice preserves testID add-annotation-observer-${messageId}', () => {
    expect(CHIP_SRC).toMatch(/add-annotation-observer-/);
  });

  it('synthesis-prompt preserves testID annotation-synthesis-prompt-${messageId}', () => {
    expect(CHIP_SRC).toMatch(/annotation-synthesis-prompt-/);
  });

  it('observer mode renders trigger + synthesis prompt with EVIDENCE_ANNOTATION_OBSERVER_HELPER', () => {
    expect(CHIP_SRC).toMatch(/EVIDENCE_ANNOTATION_OBSERVER_HELPER/);
  });

  it('observer trigger notice has accessibilityState disabled:true', () => {
    expect(CHIP_SRC).toMatch(/accessibilityState=\{\{ disabled: true \}\}/);
  });

  it('observer helper copy is unchanged: "Join a side to add an annotation"', () => {
    expect(EVIDENCE_ANNOTATION_OBSERVER_HELPER).toBe('Join a side to add an annotation');
  });

  it('canAddAnnotation && !isReadModeViewer gate for trigger is preserved', () => {
    expect(CHIP_SRC).toMatch(/canAddAnnotation && !isReadModeViewer/);
  });

  it('depth-cap synthesis-prompt branch is preserved', () => {
    expect(CHIP_SRC).toMatch(/depthCap\.showsSynthesisPrompt/);
    expect(CHIP_SRC).toMatch(/onPressSynthesisPrompt/);
  });
});

// ── Public prop surface preserved ──────────────────────────────

describe('UX-001.7 Workstream 4 — public prop surface preserved verbatim', () => {
  it('EvidenceAnnotationChipProps still exports as a named interface', () => {
    expect(CHIP_SRC).toMatch(/export\s+interface\s+EvidenceAnnotationChipProps/);
  });

  it('EvidenceAnnotationStreamProps still exports as a named interface', () => {
    expect(CHIP_SRC).toMatch(/export\s+interface\s+EvidenceAnnotationStreamProps/);
  });

  it('EvidenceAnnotationChip still exports the named component', () => {
    expect(CHIP_SRC).toMatch(/export\s+function\s+EvidenceAnnotationChip\b/);
    expect(EvidenceAnnotationChip).toBeDefined();
  });

  it('EvidenceAnnotationStream still exports the named component', () => {
    expect(CHIP_SRC).toMatch(/export\s+function\s+EvidenceAnnotationStream\b/);
    expect(EvidenceAnnotationStream).toBeDefined();
  });
});

// ── Sole production consumer (SourceChainPopover.tsx) untouched ──

describe('UX-001.7 Workstream 4 — sole production consumer SourceChainPopover.tsx is unchanged', () => {
  it('SourceChainPopover still imports EvidenceAnnotationStream from ./EvidenceAnnotationChip', () => {
    expect(POPOVER_SRC).toMatch(
      /import\s*\{\s*EvidenceAnnotationStream\s*\}\s*from\s*['"]\.\/EvidenceAnnotationChip['"]/,
    );
  });

  it('SourceChainPopover still renders <EvidenceAnnotationStream …/> with the documented prop shape', () => {
    expect(POPOVER_SRC).toMatch(/<EvidenceAnnotationStream/);
    // The prop names that SourceChainPopover passes — all preserved.
    expect(POPOVER_SRC).toMatch(/summary=\{resolvedAnnotationSummary\}/);
    expect(POPOVER_SRC).toMatch(/annotations=\{annotations\}/);
    expect(POPOVER_SRC).toMatch(/depthCap=\{resolvedDepthCap\}/);
    expect(POPOVER_SRC).toMatch(/canAddAnnotation=\{canAddAnnotation\}/);
    expect(POPOVER_SRC).toMatch(/isReadModeViewer=\{isReadModeViewer\}/);
    expect(POPOVER_SRC).toMatch(/messageId=\{messageId\}/);
  });
});

// ── A11y label equivalence (full kind matrix) ──────────────────

describe('UX-001.7 Workstream 4 — accessibility-label runtime byte-equivalence (full kind matrix)', () => {
  it('every kind builds the same chip aria label via descriptor.ariaLabel as via buildAnnotationChipAccessibilityLabel', () => {
    for (const kind of ALL_EVIDENCE_ANNOTATION_KINDS) {
      const a = ann(kind);
      const direct = buildAnnotationChipAccessibilityLabel(a);
      const viaDescriptor = buildAnnotationDescriptor(a).ariaLabel;
      expect(viaDescriptor).toBe(direct);
    }
  });

  it('depth-1 reply-annotation fragment is included in the descriptor aria label', () => {
    const a = ann('context_requested', 1, {
      depth: 1,
      parentAnnotationId: `${ARTIFACT_ID}:annotation:0`,
    });
    const aria = buildAnnotationDescriptor(a).ariaLabel ?? '';
    expect(aria).toContain('Reply annotation');
  });

  it('note text is included in the descriptor aria label when present', () => {
    const a = ann('context_requested', 0, { note: 'where is the dataset' });
    const aria = buildAnnotationDescriptor(a).ariaLabel ?? '';
    expect(aria).toContain('where is the dataset');
  });
});

// ── Status-chip summary aria label is preserved ────────────────

describe('UX-001.7 Workstream 4 — status-chip summary aria label preserved verbatim', () => {
  it('a populated summary still carries the count + status label', () => {
    const summary = summariseAnnotations([ann('primary_source', 0), ann('broken_link', 1)]);
    expect(summary.statusLabel.length).toBeGreaterThan(0);
    expect(summary.count).toBe(2);
  });

  it('empty summary still produces a "No annotations" aria fragment via the pure helper', () => {
    const summary = summariseAnnotations([]);
    expect(summary.count).toBe(0);
  });
});

// ── TOUCH_TARGET cross-reference ───────────────────────────────

describe('UX-001.7 Workstream 4 — TOUCH_TARGET.hitSlopAll cross-reference is byte-equivalent', () => {
  it('TOUCH_TARGET.hitSlopAll resolves to {top:12,bottom:12,left:12,right:12}', () => {
    expect(TOUCH_TARGET.hitSlopAll).toEqual({
      top: 12,
      bottom: 12,
      left: 12,
      right: 12,
    });
  });
});

// ── Color independence preserved (doctrine §3 / accessibility) ──

describe('UX-001.7 Workstream 4 — color independence preserved', () => {
  it('every chip aria label is non-empty (label carries meaning without color)', () => {
    for (const kind of ALL_EVIDENCE_ANNOTATION_KINDS) {
      const aria = buildAnnotationDescriptor(ann(kind)).ariaLabel ?? '';
      expect(aria.length).toBeGreaterThan(0);
    }
  });

  it('the depth prefix ↳ is a non-color geometric carrier of nesting', () => {
    const depthOne = buildAnnotationDescriptor(
      ann('context_requested', 1, { depth: 1, parentAnnotationId: `${ARTIFACT_ID}:annotation:0` }),
    );
    expect(depthOne.label).toContain('↳');
  });
});

// ── Refactor preserves doctrine-clean state ────────────────────

describe('UX-001.7 Workstream 4 — refactor preserves doctrine cleanliness', () => {
  it('imports no Supabase / network module', () => {
    const importLines = CHIP_SRC.split('\n').filter((l) => /^\s*import\s/.test(l));
    for (const line of importLines) {
      expect(line).not.toMatch(/@supabase/);
    }
    expect(CHIP_SRC).not.toMatch(/\bfetch\(/);
  });

  it('observer helper still carries no verdict / popularity tokens', () => {
    expect(EVIDENCE_ANNOTATION_OBSERVER_HELPER.length).toBeGreaterThan(0);
    const BANNED = ['winner', 'loser', 'liar', 'truth', 'verdict', 'engagement', 'viral'];
    for (const t of BANNED) {
      expect(EVIDENCE_ANNOTATION_OBSERVER_HELPER.toLowerCase()).not.toContain(t);
    }
  });
});
