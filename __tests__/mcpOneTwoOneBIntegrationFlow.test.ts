/**
 * MCP-021B — Integration data-flow tests.
 *
 * Asserts that the room loader / hook / surface / strip thread persisted
 * Machine Observation rows through correctly:
 *
 *   1. `computeNodeLabelStripDescriptors` accepts `persistedClassifierRows`
 *      and forwards them into `adaptAllSourcesForNode`.
 *   2. `computeNodeLabelInspectGroups` accepts `persistedClassifierRows`
 *      and forwards them with surface 'inspect' (lower confidence floor).
 *   3. Pre-MCP-021B callers (omit the prop) get identical descriptors to
 *      the post-MCP-021B caller passing `[]`.
 */

import { computeNodeLabelStripDescriptors } from '../src/features/nodeLabels/NodeLabelStrip';
import { computeNodeLabelInspectGroups } from '../src/features/nodeLabels/NodeLabelInspectGroups';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../src/features/nodeLabels/mcpBooleanObservationSchema';
import type { MachineObservationResultRow } from '../src/features/nodeLabels/machineObservationPersistenceTypes';

const MESSAGE_ID = 'msg-int-1';

function row(overrides: Partial<MachineObservationResultRow> = {}): MachineObservationResultRow {
  return {
    id: 'res-1',
    runId: 'run-1',
    debateId: 'deb-1',
    argumentId: MESSAGE_ID,
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    rawKey: 'has_rebuttal',
    family: 'parent_relation',
    confidence: 'high',
    evidenceSpan: null,
    createdAt: '2026-05-26T00:00:00.000Z',
    ...overrides,
  };
}

describe('MCP-021B — NodeLabelStrip integration', () => {
  it('omitting persistedClassifierRows produces the pre-MCP-021B descriptors (byte-equal baseline)', () => {
    const baseline = computeNodeLabelStripDescriptors({
      messageId: MESSAGE_ID,
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'open',
      messageContribution: null,
    });
    expect(baseline.descriptors).toEqual([]);
    expect(baseline.visibleCount).toBe(0);
  });

  it('passing empty persistedClassifierRows produces identical descriptors to omitting it', () => {
    const omitted = computeNodeLabelStripDescriptors({
      messageId: MESSAGE_ID,
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'open',
      messageContribution: null,
    });
    const emptyArray = computeNodeLabelStripDescriptors({
      messageId: MESSAGE_ID,
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'open',
      messageContribution: null,
      persistedClassifierRows: [],
    });
    expect(emptyArray.descriptors).toEqual(omitted.descriptors);
    expect(emptyArray.maxVisible).toBe(omitted.maxVisible);
    expect(emptyArray.visibleCount).toBe(omitted.visibleCount);
  });

  it('passing one valid persisted row surfaces a Machine Observation descriptor in the strip', () => {
    const result = computeNodeLabelStripDescriptors({
      messageId: MESSAGE_ID,
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'open',
      messageContribution: null,
      persistedClassifierRows: [row()],
    });
    expect(result.visibleCount).toBeGreaterThanOrEqual(1);
  });
});

describe('MCP-021B — NodeLabelInspectGroups integration', () => {
  it('omitting persistedClassifierRows produces an identical grouped view to passing empty', () => {
    // clusterState: 'open' already surfaces one lifecycle Machine
    // Observation (registry: rawKey 'open', disposition 'inspect_only').
    // The baseline is therefore not necessarily 0 observations; the
    // load-bearing assertion is that omitting persistedClassifierRows is
    // byte-equal to passing []. Both go through the same adapter chain.
    const omitted = computeNodeLabelInspectGroups({
      messageId: MESSAGE_ID,
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'open',
      messageContribution: null,
    });
    const emptyArray = computeNodeLabelInspectGroups({
      messageId: MESSAGE_ID,
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'open',
      messageContribution: null,
      persistedClassifierRows: [],
    });
    expect(emptyArray.observationCount).toBe(omitted.observationCount);
    expect(emptyArray.allegationCount).toBe(omitted.allegationCount);
  });

  it('passing one valid persisted row increases observation count by 1 (additive to lifecycle baseline)', () => {
    const baseline = computeNodeLabelInspectGroups({
      messageId: MESSAGE_ID,
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'open',
      messageContribution: null,
    });
    const withRow = computeNodeLabelInspectGroups({
      messageId: MESSAGE_ID,
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'open',
      messageContribution: null,
      persistedClassifierRows: [row()],
    });
    expect(withRow.observationCount).toBe(baseline.observationCount + 1);
    expect(withRow.allegationCount).toBe(baseline.allegationCount);
  });

  it('persisted row with disposition future_source (quote_anchors_parent) does NOT surface on inspect', () => {
    // quote_anchors_parent is Family A, ai_classifier, disposition
    // future_source. The persistence adapter emits the mark; the
    // downstream filterMarksBySurface drops it because future_source is
    // never eligible. Net effect: observationCount equals the baseline.
    const baseline = computeNodeLabelInspectGroups({
      messageId: MESSAGE_ID,
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'open',
      messageContribution: null,
    });
    const withRow = computeNodeLabelInspectGroups({
      messageId: MESSAGE_ID,
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'open',
      messageContribution: null,
      persistedClassifierRows: [row({ rawKey: 'quote_anchors_parent', confidence: 'low' })],
    });
    expect(withRow.observationCount).toBe(baseline.observationCount);
  });
});
