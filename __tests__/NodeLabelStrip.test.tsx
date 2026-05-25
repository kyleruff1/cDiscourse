/**
 * UX-001.5A — NodeLabelStrip tests.
 *
 * Maps acceptance criteria AC 3, 13, 17 (Timeline visually
 * distinguishes + 1+1+overflow + no verdict copy).
 *
 * Uses the pure `computeNodeLabelStripDescriptors` helper for behavior
 * tests; the component shell is verified via source-scan to ensure it
 * composes the read-only `AnnotationChipStrip` primitive (no new
 * visual primitive — conditional trigger 4 CLEAN).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ManualTagEntry } from '../src/features/metadata/moveMetadataLedger';
import { computeNodeLabelStripDescriptors } from '../src/features/nodeLabels/NodeLabelStrip';

function manualTag(code: string): ManualTagEntry {
  return {
    code: code as ManualTagEntry['code'],
    appliedByUserId: 'user-1',
    appliedByActorRole: 'participant_affirmative',
    appliedAt: '2026-05-25T12:00:00.000Z',
    dedupeKey: `${code}:user-1`,
  };
}

const STRIP_SRC = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'nodeLabels', 'NodeLabelStrip.tsx'),
  'utf8',
);

describe('UX-001.5A — NodeLabelStrip — source composition (conditional trigger 4)', () => {
  it('imports AnnotationChipStrip (composes the read-only primitive)', () => {
    expect(STRIP_SRC).toMatch(/import \{ AnnotationChipStrip \} from .+nodeAnnotations\/AnnotationChipStrip/);
  });

  it('does NOT introduce a new visual primitive (no new StyleSheet beyond container)', () => {
    // StyleSheet exists for the container margin; that's a layout style,
    // not a new visual primitive. The pill shape comes from the chip.
    const styleMatches = STRIP_SRC.match(/StyleSheet\.create/g) ?? [];
    expect(styleMatches.length).toBeLessThanOrEqual(1);
  });

  it('does NOT import a new color token or hex literal', () => {
    expect(STRIP_SRC).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});

describe('UX-001.5A — computeNodeLabelStripDescriptors — empty cases', () => {
  it('returns empty for empty messageId', () => {
    const result = computeNodeLabelStripDescriptors({
      messageId: '',
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'open',
      messageContribution: null,
    });
    expect(result.descriptors).toEqual([]);
    expect(result.visibleCount).toBe(0);
  });

  it('returns empty when no marks apply', () => {
    // clusterState 'open' is inspect_only → not eligible for timeline_node.
    const result = computeNodeLabelStripDescriptors({
      messageId: 'msg-1',
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'open',
      messageContribution: null,
    });
    expect(result.descriptors).toEqual([]);
    expect(result.visibleCount).toBe(0);
  });
});

describe('UX-001.5A — computeNodeLabelStripDescriptors — 1+1 happy path', () => {
  it('renders 1 Observation + 1 Allegation with no overflow', () => {
    const result = computeNodeLabelStripDescriptors({
      messageId: 'msg-1',
      manualTagEntries: [manualTag('needs_source')],
      autoMetadataCodes: ['has_evidence'],
      clusterState: 'rebutted',
      messageContribution: null,
    });
    // 3 marks: needs_source (allegation), has_evidence (auto observation),
    // rebutted (lifecycle observation). Cap picks 1 observation + 1 allegation.
    expect(result.visibleCount).toBe(2);
    // Find the Observation descriptor and Allegation descriptor.
    const obsDesc = result.descriptors.find((d) => d.source === 'machine');
    const allDesc = result.descriptors.find((d) => d.source === 'user');
    expect(obsDesc).toBeDefined();
    expect(allDesc).toBeDefined();
  });

  it('uses the higher-priority observation (lifecycle over auto_metadata)', () => {
    const result = computeNodeLabelStripDescriptors({
      messageId: 'msg-1',
      manualTagEntries: [],
      autoMetadataCodes: ['has_evidence'], // priority 20
      clusterState: 'rebutted', // priority 14
      messageContribution: null,
    });
    expect(result.visibleCount).toBe(1);
    expect(result.descriptors[0].source).toBe('machine');
    // The 'Pressured' shortLabel comes from the lifecycle entry.
    expect(result.descriptors[0].label).toBe('Pressured');
  });
});

describe('UX-001.5A — computeNodeLabelStripDescriptors — overflow', () => {
  it('renders 1+1 + overflow indicator when more than 2 marks apply', () => {
    const result = computeNodeLabelStripDescriptors({
      messageId: 'msg-1',
      manualTagEntries: [manualTag('needs_source'), manualTag('definition_issue')],
      autoMetadataCodes: ['has_evidence', 'has_rebuttal'],
      clusterState: 'rebutted',
      messageContribution: 'sourced',
      // marks: 2 allegations + 2 auto observations + 2 lifecycle observations = 6 marks
      // (rebutted lifecycle, sourced lifecycle, has_evidence auto, has_rebuttal auto,
      //  plus the 2 manual tags).
      // Some of these may dedupe (sourced + has_evidence are different labels).
      // Cap picks 1 obs + 1 all → overflowCount = remaining.
    });
    expect(result.visibleCount).toBe(2);
    // Overflow trigger: descriptors.length > maxVisible. maxVisible was set
    // to visible.length + 1 = 3; descriptors.length = visible + overflow + 1.
    expect(result.descriptors.length).toBeGreaterThan(result.maxVisible);
    expect(result.maxVisible).toBe(3);
  });
});

describe('UX-001.5A — descriptors are Observation/Allegation discriminated', () => {
  it('Machine Observation ariaLabel prefix is "Machine observation:"', () => {
    const result = computeNodeLabelStripDescriptors({
      messageId: 'msg-1',
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'rebutted',
      messageContribution: null,
    });
    const obsDesc = result.descriptors.find((d) => d.source === 'machine');
    expect(obsDesc?.ariaLabel).toMatch(/^Machine observation:/);
  });

  it('User Allegation ariaLabel prefix is "User allegation:"', () => {
    const result = computeNodeLabelStripDescriptors({
      messageId: 'msg-1',
      manualTagEntries: [manualTag('needs_source')],
      autoMetadataCodes: [],
      clusterState: 'open', // inspect_only — not in timeline
      messageContribution: null,
    });
    const allDesc = result.descriptors.find((d) => d.source === 'user');
    expect(allDesc?.ariaLabel).toMatch(/^User allegation:/);
  });
});

describe('UX-001.5A — sensitive composer-only IDs NEVER surface here', () => {
  it('does NOT render shifts_to_person_or_intent even when it might fire upstream', () => {
    // The strip never receives composer_only marks because the source 5
    // node-mount adapter returns [] unconditionally AND the registry's
    // composer_only entries are filtered out by the timeline_node surface
    // gate.
    const result = computeNodeLabelStripDescriptors({
      messageId: 'msg-1',
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'rebutted',
      messageContribution: null,
    });
    // No descriptor should carry a sensitive raw key.
    for (const desc of result.descriptors) {
      expect(desc.id).not.toMatch(/shifts_to_person_or_intent/);
      expect(desc.id).not.toMatch(/contains_unplayable_insult_only/);
      expect(desc.id).not.toMatch(/needs_pre_send_pause/);
      expect(desc.id).not.toMatch(/uses_popularity_as_evidence/);
      expect(desc.id).not.toMatch(/uses_satire_as_evidence/);
    }
  });
});

describe('UX-001.5A — future_source codes NEVER surface here', () => {
  it('does NOT render AI classifier codes (all future_source)', () => {
    const result = computeNodeLabelStripDescriptors({
      messageId: 'msg-1',
      manualTagEntries: [],
      autoMetadataCodes: [],
      clusterState: 'rebutted',
      messageContribution: null,
    });
    for (const desc of result.descriptors) {
      // AI classifier rawKeys (samples) should never appear.
      expect(desc.id).not.toMatch(/introduces_new_issue/);
      expect(desc.id).not.toMatch(/creates_source_chain_gap/);
      expect(desc.id).not.toMatch(/quote_anchors_parent/);
    }
  });
});
