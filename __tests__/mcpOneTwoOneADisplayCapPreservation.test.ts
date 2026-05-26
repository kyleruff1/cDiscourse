/**
 * MCP-021A — Test category 6: Display cap preservation.
 *
 * Per design §8.6. Verifies UX-001.5A display caps are NOT changed by
 * MCP-021A. Tests use synthetic high-volume marks and assert caps
 * still apply.
 *
 * Cap rules (per UX-001.5A nodeLabelPresentationModel):
 *   - Timeline: 0/1 Observation + 0/1 Allegation
 *   - Selected: ≤3 Observations + ≤3 Allegations
 *   - Inspect: unbounded grouped
 */

import {
  enforceInspectGroupedView,
  enforceSelectedContextDisplayCap,
  enforceTimelineNodeDisplayCap,
} from '../src/features/nodeLabels/nodeLabelPresentationModel';
import type { NodeLabelMark } from '../src/features/nodeLabels/nodeLabelTypes';

function synthMark(
  source: NodeLabelMark['source'],
  kind: NodeLabelMark['kind'],
  i: number,
): NodeLabelMark {
  return Object.freeze({
    id: `synth:${source}:${kind}:${i}`,
    rawKey: `synth_key_${i}`,
    kind,
    source,
    label: `Label ${i}`,
    shortLabel: `L${i}`,
    description: `Description ${i}`,
    defaultSurface: 'timeline_node' as const,
    disposition: 'rendered_now' as const,
    priority: 10 + i,
    visibleByDefault: true,
  });
}

describe('MCP-021A — Display cap preservation (UX-001.5A binding)', () => {
  it('Timeline cap holds at 0/1 Observation + 0/1 Allegation with synthetic 150-positive set', () => {
    const observations: NodeLabelMark[] = [];
    const allegations: NodeLabelMark[] = [];
    for (let i = 0; i < 100; i++) {
      observations.push(synthMark('ai_classifier', 'machine_observation', i));
    }
    for (let i = 0; i < 50; i++) {
      allegations.push(synthMark('manual_tag', 'user_allegation', i));
    }
    const result = enforceTimelineNodeDisplayCap([...observations, ...allegations]);
    // Cap per UX-001.5A: at most 1 Observation + 1 Allegation visible.
    // Result shape: observation: Mark|null, allegation: Mark|null, overflowCount.
    if (result.observation) {
      expect(result.observation.kind).toBe('machine_observation');
    }
    if (result.allegation) {
      expect(result.allegation.kind).toBe('user_allegation');
    }
    expect(result.overflowCount).toBeGreaterThan(0);
  });

  it('Selected-context cap holds at 3 Observations + 3 Allegations with synthetic 150-positive set', () => {
    const observations: NodeLabelMark[] = [];
    const allegations: NodeLabelMark[] = [];
    for (let i = 0; i < 100; i++) {
      observations.push(synthMark('ai_classifier', 'machine_observation', i));
    }
    for (let i = 0; i < 50; i++) {
      allegations.push(synthMark('manual_tag', 'user_allegation', i));
    }
    const result = enforceSelectedContextDisplayCap([...observations, ...allegations]);
    expect(result.observations.length).toBeLessThanOrEqual(3);
    expect(result.allegations.length).toBeLessThanOrEqual(3);
    expect(result.overflowCount).toBeGreaterThan(0);
  });

  it('Inspect grouped view shows full set (unbounded)', () => {
    const marks: NodeLabelMark[] = [];
    for (let i = 0; i < 100; i++) {
      marks.push(synthMark('ai_classifier', 'machine_observation', i));
    }
    const result = enforceInspectGroupedView(marks);
    // Inspect is unbounded grouped.
    const totalVisible = result.observations.length + result.allegations.length;
    expect(totalVisible).toBeGreaterThanOrEqual(100);
  });

  it('Timeline cap returns overflowCount when input has 150 marks', () => {
    const marks: NodeLabelMark[] = [];
    for (let i = 0; i < 100; i++) {
      marks.push(synthMark('ai_classifier', 'machine_observation', i));
    }
    for (let i = 0; i < 50; i++) {
      marks.push(synthMark('manual_tag', 'user_allegation', i));
    }
    const result = enforceTimelineNodeDisplayCap(marks);
    expect(result.overflowCount).toBeGreaterThanOrEqual(148);
  });
});
