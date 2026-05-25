/**
 * UX-001.5 — AnnotationChipStrip overflow + render contract.
 *
 * Source-scan + module-load tests for the chip strip:
 *   - When descriptors.length <= maxVisible, the strip renders all chips.
 *   - When the count exceeds maxVisible, the strip renders
 *     (maxVisible - 1) chips + one overflow chip.
 *   - The overflow chip triggers an internal expanded state unless
 *     onOverflowPress is supplied.
 *   - The strip wraps in AnnotationFocusBoundary on web.
 *   - Native renders the strip directly (no AnnotationFocusBoundary
 *     wrapper on the native path).
 *   - Container uses role="list" + flexWrap rather than horizontal
 *     ScrollView (predictable cross-viewport layout).
 */
import * as fs from 'fs';
import * as path from 'path';
import { AnnotationChipStrip } from '../src/features/nodeAnnotations/AnnotationChipStrip';
import { AnnotationFocusBoundary } from '../src/features/nodeAnnotations/AnnotationFocusBoundaryView';

const NODE_ANNOTATIONS_DIR = path.join(
  process.cwd(),
  'src',
  'features',
  'nodeAnnotations',
);

const STRIP_SRC = fs.readFileSync(
  path.join(NODE_ANNOTATIONS_DIR, 'AnnotationChipStrip.tsx'),
  'utf8',
);

const FOCUS_BOUNDARY_SRC = fs.readFileSync(
  path.join(NODE_ANNOTATIONS_DIR, 'AnnotationFocusBoundaryView.tsx'),
  'utf8',
);

/** Strip block + line comments so source-scan inspects real CODE. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const STRIP_CODE = stripComments(STRIP_SRC);

describe('UX-001.5 — AnnotationChipStrip module loads', () => {
  it('exports AnnotationChipStrip', () => {
    expect(typeof AnnotationChipStrip).toBe('function');
  });
});

describe('UX-001.5 — AnnotationFocusBoundary module loads', () => {
  it('exports AnnotationFocusBoundary', () => {
    expect(typeof AnnotationFocusBoundary).toBe('function');
  });
});

describe('UX-001.5 — AnnotationChipStrip render contract (source-scan)', () => {
  it('imports AnnotationChip + AnnotationOverflowChip + AnnotationFocusBoundary', () => {
    expect(STRIP_SRC).toMatch(/from\s+['"]\.\/AnnotationChip['"]/);
    expect(STRIP_SRC).toMatch(/from\s+['"]\.\/AnnotationOverflowChip['"]/);
    expect(STRIP_SRC).toMatch(/from\s+['"]\.\/AnnotationFocusBoundaryView['"]/);
  });

  it('uses flexWrap (not horizontal ScrollView) for cross-viewport stability', () => {
    expect(STRIP_SRC).toMatch(/flexWrap:\s*['"]wrap['"]/);
    // Code-only scan — the doctrine comment may mention ScrollView in
    // prose. The render path must not import or use ScrollView.
    expect(STRIP_CODE).not.toMatch(/ScrollView/);
  });

  it('container exposes role="list" + composed aria label', () => {
    expect(STRIP_SRC).toMatch(/accessibilityRole="list"/);
    expect(STRIP_SRC).toMatch(/accessibilityLabel=\{stripAriaLabel\}/);
    expect(STRIP_SRC).toMatch(/buildAnnotationStripAriaLabel/);
  });

  it('reserves one slot for the overflow chip when overflow is present', () => {
    // The "maxVisible - 1" slice is the load-bearing rule that keeps
    // total visible count == maxVisible.
    expect(STRIP_SRC).toMatch(/resolvedMax\s*-\s*1/);
  });

  it('wraps in AnnotationFocusBoundary only on web', () => {
    expect(STRIP_SRC).toMatch(/Platform\.OS\s*===\s*['"]web['"]/);
    expect(STRIP_SRC).toMatch(/<AnnotationFocusBoundary/);
  });

  it('overflow chip count includes any slots truncated by the (max - 1) slice', () => {
    // overflowCountForChip = safeDescriptors.length - visibleDescriptors.length
    // ensures the displayed N matches the true overflow.
    expect(STRIP_SRC).toMatch(/overflowCountForChip/);
  });

  it('renders nothing for an empty descriptor list', () => {
    expect(STRIP_SRC).toMatch(/if\s*\(\s*safeDescriptors\.length\s*===\s*0\s*\)\s*return\s+null/);
  });

  it('resolves maxVisible from the band table when not explicitly set', () => {
    expect(STRIP_SRC).toMatch(/ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND/);
    expect(STRIP_SRC).toMatch(/resolveBandValue/);
  });
});

describe('UX-001.5 — AnnotationFocusBoundary render contract (source-scan)', () => {
  it('uses the pure-TS focus interpreter', () => {
    expect(FOCUS_BOUNDARY_SRC).toMatch(/resolveFocusBoundaryKeyEffect/);
    expect(FOCUS_BOUNDARY_SRC).toMatch(/applyFocusBoundaryEffect/);
  });

  it('attaches onKeyDown only on web', () => {
    expect(FOCUS_BOUNDARY_SRC).toMatch(/Platform\.OS\s*!==\s*['"]web['"]/);
    expect(FOCUS_BOUNDARY_SRC).toMatch(/onKeyDown/);
  });

  it('sets tabIndex={0} only on web', () => {
    expect(FOCUS_BOUNDARY_SRC).toMatch(/tabIndex:\s*0/);
  });

  it('calls preventDefault when an effect consumes the key (no page scroll)', () => {
    expect(FOCUS_BOUNDARY_SRC).toMatch(/preventDefault/);
  });
});

describe('UX-001.5 — AnnotationChipStrip is token-only (no hex literals)', () => {
  it('AnnotationChipStrip.tsx has no hex literals', () => {
    expect(STRIP_SRC.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });
  it('AnnotationFocusBoundaryView.tsx has no hex literals', () => {
    expect(FOCUS_BOUNDARY_SRC.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });
});
