/**
 * ROOM-004 (#886) — MapNodeSidecarLinks.
 *
 * The low-density deep-link footer for the Map lens sidecar. Mounts in col2
 * AFTER the reused readout + friendly-flags row, carrying the deep-links the
 * readout lacks: Answer this (J9 jump to Exchange scoped), Open disagreement
 * points, and a read-only open-point membership line.
 *
 * Doctrine (cdiscourse-doctrine, accessibility-targets):
 *   - Interactive links are real Pressables with button role + at least 44x44.
 *   - The membership line is display-only text (no clickable box) — affordance
 *     consistency.
 *   - Advisory + plain-language: the membership line is procedural (mediator
 *     board), never popularity or a verdict. Renders nothing when the node has
 *     no open-point membership.
 *   - No verdict tokens. No AI. No Supabase. All comments apostrophe-free.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MapNodeActionSurface } from './mapNodeActionSurfaceModel';

export interface MapNodeSidecarLinksProps {
  surface: MapNodeActionSurface;
  onAnswerThis: () => void;
  onOpenDebts: () => void;
  reduceMotion?: boolean;
}

export function MapNodeSidecarLinks(props: MapNodeSidecarLinksProps) {
  const { surface } = props;
  return (
    <View style={styles.wrap} testID="map-sidecar-links">
      <Pressable
        onPress={props.onAnswerThis}
        accessibilityRole="button"
        accessibilityLabel="Answer this"
        accessibilityHint={surface.answerThisHint}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        testID="map-sidecar-answer-this"
        style={[styles.link, styles.linkPrimary]}
      >
        <Text style={styles.linkTextPrimary}>{surface.answerThisLabel}</Text>
      </Pressable>

      <Pressable
        onPress={props.onOpenDebts}
        accessibilityRole="button"
        accessibilityLabel="Open disagreement points"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        testID="map-sidecar-open-debts"
        style={[styles.link, styles.linkGhost]}
      >
        <Text style={styles.linkTextGhost}>
          {surface.sidecarLinks.find((l) => l.key === 'open_debts')?.label ?? 'Open disagreement points'}
        </Text>
      </Pressable>

      {surface.openPointMembershipLine ? (
        <Text style={styles.membership} testID="map-sidecar-point-membership">
          {surface.openPointMembershipLine}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'column', gap: 8, paddingHorizontal: 8, paddingTop: 6 },
  link: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    minHeight: 44,
    minWidth: 44,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkPrimary: { backgroundColor: '#4338ca' },
  linkGhost: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  linkTextPrimary: { color: '#f8fafc', fontSize: 13, fontWeight: '800' },
  linkTextGhost: { color: '#cbd5e1', fontSize: 13, fontWeight: '700' },
  membership: { color: '#94a3b8', fontSize: 12, fontWeight: '600', paddingTop: 2 },
});
