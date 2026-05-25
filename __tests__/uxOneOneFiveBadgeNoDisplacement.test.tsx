/**
 * UX-001.5 — Badge primitives mount without layout displacement.
 *
 * Critical regression preservation (design §12, brief §"Cross-viewport
 * rendering"): when a badge mounts on a timeline node, it MUST sit as
 * an overlay rather than displacing the rail's vertical position. This
 * preserves UX-001.2's BAND_RAIL_OFFSET caps (128/168/200).
 *
 * The contract has two halves:
 *   1. The badge primitive itself NEVER sets top / right / bottom /
 *      left / margin* styles (the caller supplies the overlay style).
 *   2. The caller mounts the badge with absolute positioning following
 *      the `receiptMark` precedent at `ArgumentTimelineMap.tsx:1264-1278`.
 *
 * This suite asserts both halves via source-scan: the primitive file
 * has no positioning literals, and the receiptMark precedent in
 * ArgumentTimelineMap remains the documented pattern.
 */
import * as fs from 'fs';
import * as path from 'path';
import { AnnotationBadge } from '../src/features/nodeAnnotations/AnnotationBadge';
import { AnnotationBadgeCluster } from '../src/features/nodeAnnotations/AnnotationBadgeCluster';
import { AnnotationEdgeHighlight } from '../src/features/nodeAnnotations/AnnotationEdgeHighlight';

const NODE_ANNOTATIONS_DIR = path.join(
  process.cwd(),
  'src',
  'features',
  'nodeAnnotations',
);

const BADGE_SRC = fs.readFileSync(
  path.join(NODE_ANNOTATIONS_DIR, 'AnnotationBadge.tsx'),
  'utf8',
);
const BADGE_CLUSTER_SRC = fs.readFileSync(
  path.join(NODE_ANNOTATIONS_DIR, 'AnnotationBadgeCluster.tsx'),
  'utf8',
);
const EDGE_HIGHLIGHT_SRC = fs.readFileSync(
  path.join(NODE_ANNOTATIONS_DIR, 'AnnotationEdgeHighlight.tsx'),
  'utf8',
);

const TIMELINE_MAP_SRC = fs.readFileSync(
  path.join(
    process.cwd(),
    'src',
    'features',
    'arguments',
    'ArgumentTimelineMap.tsx',
  ),
  'utf8',
);

/**
 * Strip block + line comments so the displacement scan inspects real
 * CODE only — a doctrine comment naming `top:` would otherwise trigger.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('UX-001.5 — AnnotationBadge / AnnotationBadgeCluster / AnnotationEdgeHighlight modules load', () => {
  it('AnnotationBadge exports the component', () => {
    expect(typeof AnnotationBadge).toBe('function');
  });
  it('AnnotationBadgeCluster exports the component', () => {
    expect(typeof AnnotationBadgeCluster).toBe('function');
  });
  it('AnnotationEdgeHighlight exports the component', () => {
    expect(typeof AnnotationEdgeHighlight).toBe('function');
  });
});

describe('UX-001.5 — AnnotationBadge has no positioning literals in styles (no displacement)', () => {
  const code = stripComments(BADGE_SRC);

  it('no literal top/right/bottom/left in the styles block', () => {
    // The displacement contract: the primitive's OWN styles must not
    // set absolute-position offsets. Caller supplies via `style` prop.
    // Pattern: `top: <number>`, `left: <number>`, etc.
    const stylesBlockMatch = code.match(/StyleSheet\.create\(([\s\S]*?)\);/);
    expect(stylesBlockMatch).not.toBeNull();
    const stylesBlock = stylesBlockMatch?.[1] ?? '';
    expect(stylesBlock).not.toMatch(/\btop:\s*-?\d/);
    expect(stylesBlock).not.toMatch(/\bleft:\s*-?\d/);
    expect(stylesBlock).not.toMatch(/\bright:\s*-?\d/);
    expect(stylesBlock).not.toMatch(/\bbottom:\s*-?\d/);
    expect(stylesBlock).not.toMatch(/\bmarginTop:\s*-?\d/);
    expect(stylesBlock).not.toMatch(/\bmarginBottom:\s*-?\d/);
    expect(stylesBlock).not.toMatch(/\bmarginLeft:\s*-?\d/);
    expect(stylesBlock).not.toMatch(/\bmarginRight:\s*-?\d/);
  });

  it('no `position: "absolute"` in the styles block (caller controls position)', () => {
    const stylesBlockMatch = code.match(/StyleSheet\.create\(([\s\S]*?)\);/);
    const stylesBlock = stylesBlockMatch?.[1] ?? '';
    expect(stylesBlock).not.toMatch(/position:\s*['"]absolute['"]/);
  });
});

describe('UX-001.5 — AnnotationEdgeHighlight has no positioning literals (overlay friendly)', () => {
  const code = stripComments(EDGE_HIGHLIGHT_SRC);
  const stylesBlockMatch = code.match(/StyleSheet\.create\(([\s\S]*?)\);/);

  it('styles block exists', () => {
    expect(stylesBlockMatch).not.toBeNull();
  });

  it('no literal top/right/bottom/left/width in the styles block', () => {
    const stylesBlock = stylesBlockMatch?.[1] ?? '';
    expect(stylesBlock).not.toMatch(/\btop:\s*-?\d/);
    expect(stylesBlock).not.toMatch(/\bleft:\s*-?\d/);
    expect(stylesBlock).not.toMatch(/\bright:\s*-?\d/);
    expect(stylesBlock).not.toMatch(/\bbottom:\s*-?\d/);
    // Width left to caller so the line is positioned exactly between
    // two timeline nodes.
    expect(stylesBlock).not.toMatch(/\bwidth:\s*\d/);
  });
});

describe('UX-001.5 — ArgumentTimelineMap.receiptMark precedent is preserved', () => {
  // The receiptMark overlay pattern is the documented precedent (audit
  // §1 #12) that UX-001.5 follows. If this assertion fires, the
  // precedent moved and the design doc + the badge primitive both need
  // a corresponding update.
  it('receiptMark mounts with position: absolute', () => {
    expect(TIMELINE_MAP_SRC).toMatch(/receiptMark[\s\S]*?position:\s*['"]absolute['"]/);
  });

  it('receiptMark uses corner offsets (top: -3, right: -3)', () => {
    expect(TIMELINE_MAP_SRC).toMatch(/top:\s*-3[\s\S]{0,100}?right:\s*-3/);
  });
});

describe('UX-001.5 — BadgeCluster overlap uses negative marginLeft (intentional)', () => {
  // The stacked layout's 4px overlap is the ONE intentional negative
  // margin in the cluster primitive. The badge primitive itself still
  // has no margins; the overlap is in the cluster's own slot styles.
  it('cluster contains stackedOffset rule with marginLeft: -4', () => {
    const code = stripComments(BADGE_CLUSTER_SRC);
    expect(code).toMatch(/stackedOffset[\s\S]*?marginLeft:\s*-4/);
  });
});

describe('UX-001.5 — primitive overlay token compliance', () => {
  it('AnnotationBadge.tsx contains no hex literals', () => {
    expect(BADGE_SRC.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });
  it('AnnotationBadgeCluster.tsx contains no hex literals', () => {
    expect(BADGE_CLUSTER_SRC.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });
  it('AnnotationEdgeHighlight.tsx contains no hex literals', () => {
    expect(EDGE_HIGHLIGHT_SRC.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });
});
