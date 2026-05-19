/**
 * SC-003 — ArgumentReplySidecar (detail inspector).
 *
 * Read-only docked panel for the active message. Consumes a typed
 * `SidecarViewModel` from `argumentReplySidecarModel.ts` and renders six
 * sections in a fixed order:
 *
 *   1. What this move says    — body excerpt + parent hint + bands
 *   2. Why it matters         — RULE-003 lifecycle helper
 *   3. What is unresolved     — META-001 open requests
 *   4. Where it sits          — branch / lane / depth / path
 *   5. Suggested next move    — ST-002 stub (always empty in v1)
 *   6. Semantic flags         — RULE-003 chips (Timeline: condensed)
 *
 * The sidecar carries NO action affordances and NO body editing
 * affordance. The action dock (`TimelineNodeActionDock`) sits above this
 * panel in the room shell. The boundary is test-enforced — this file
 * must contain zero references to SC-004's action vocabulary.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  SidecarSection_SemanticFlags,
  SidecarSection_SuggestedNextMove,
  SidecarSection_WhatIsUnresolved,
  SidecarSection_WhatThisMoveSays,
  SidecarSection_WhereItSits,
  SidecarSection_WhyItMatters,
  SidecarViewModel,
} from './argumentReplySidecarModel';

interface Props {
  viewModel: SidecarViewModel;
}

const SHOW_DETAILS_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

export function ArgumentReplySidecar({ viewModel }: Props) {
  if (viewModel.isEmpty) {
    return (
      <View
        style={styles.empty}
        testID="argument-reply-sidecar"
        accessibilityLabel={viewModel.accessibilityRootLabel}
      >
        <Text style={styles.emptyText}>{viewModel.emptyStateMessage}</Text>
      </View>
    );
  }

  return (
    <View
      style={styles.root}
      testID="argument-reply-sidecar"
      accessibilityLabel={viewModel.accessibilityRootLabel}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {viewModel.sections.map((section) => {
          switch (section.kind) {
            case 'what_this_move_says':
              return <WhatThisMoveSays key={section.kind} section={section} />;
            case 'why_it_matters':
              return <WhyItMatters key={section.kind} section={section} />;
            case 'what_is_unresolved':
              return <WhatIsUnresolved key={section.kind} section={section} />;
            case 'where_it_sits':
              return <WhereItSits key={section.kind} section={section} />;
            case 'suggested_next_move':
              return <SuggestedNextMove key={section.kind} section={section} />;
            case 'semantic_flags':
              return <SemanticFlags key={section.kind} section={section} />;
            default:
              return null;
          }
        })}
      </ScrollView>
    </View>
  );
}

// ── Sections ────────────────────────────────────────────────────

function SectionShell({
  testID,
  title,
  children,
}: {
  testID: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section} testID={testID} accessibilityRole="text">
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function WhatThisMoveSays({ section }: { section: SidecarSection_WhatThisMoveSays }) {
  return (
    <SectionShell testID="sidecar-section-what-this-move-says" title="What this move says">
      <View style={styles.headerRow}>
        <Text style={styles.kind}>{section.kindLabel}</Text>
        {section.sideLabel && section.sideLabel !== '—' ? (
          <>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.side}>{section.sideLabel}</Text>
          </>
        ) : null}
        <Text style={styles.dot}>·</Text>
        <Text style={styles.actor}>{section.actorLabel}</Text>
      </View>
      <Text style={styles.timestamp}>
        {section.createdAtLabel} · {section.relativeLabel}
      </Text>
      {section.isHidden ? (
        <Text style={styles.hiddenNotice}>{section.hiddenNotice}</Text>
      ) : (
        <Text style={styles.body}>{section.bodyExcerpt}</Text>
      )}
      {section.parentHint ? (
        <View style={styles.parentBlock} testID="sidecar-parent-preview">
          <Text style={styles.parentLabel}>{section.parentHint}</Text>
          {section.parentBodyPreview ? (
            <Text style={styles.parentPreview} numberOfLines={3}>
              {section.parentBodyPreview}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.bandRow}>
        <View style={styles.bandChip} testID="sidecar-standing-band">
          <Text style={styles.bandValue}>{section.standingLine}</Text>
        </View>
        <View style={styles.bandChip} testID="sidecar-tone-band">
          <Text style={styles.bandValue}>{section.toneLine}</Text>
        </View>
        <View style={styles.bandChip} testID="sidecar-temperature-band">
          <Text style={styles.bandValue}>{section.heatLine}</Text>
        </View>
      </View>
    </SectionShell>
  );
}

function WhyItMatters({ section }: { section: SidecarSection_WhyItMatters }) {
  return (
    <SectionShell testID="sidecar-section-why-it-matters" title="Why it matters">
      <Text style={styles.lifecycleLabel}>{section.lifecycleLabel}</Text>
      <Text style={styles.lifecycleHelper}>{section.lifecycleHelperLine}</Text>
    </SectionShell>
  );
}

function WhatIsUnresolved({ section }: { section: SidecarSection_WhatIsUnresolved }) {
  return (
    <SectionShell testID="sidecar-section-what-is-unresolved" title="What is unresolved">
      {section.isEmpty ? (
        <Text style={styles.emptyLine}>{section.emptyNotice}</Text>
      ) : (
        section.items.map((item) => (
          <View key={item.id} style={styles.unresolvedItem}>
            <Text style={styles.unresolvedLabel}>{item.label}</Text>
            <Text style={styles.unresolvedHelper}>{item.helperLine}</Text>
          </View>
        ))
      )}
    </SectionShell>
  );
}

function WhereItSits({ section }: { section: SidecarSection_WhereItSits }) {
  return (
    <SectionShell testID="sidecar-section-where-it-sits" title="Where it sits">
      <View style={styles.factRow}>
        <Text style={styles.factLabel}>Branch</Text>
        <Text style={styles.factValue}>{section.branchLabel}</Text>
      </View>
      <View style={styles.factRow}>
        <Text style={styles.factLabel}>Position</Text>
        <Text style={styles.factValue}>
          Message {section.ordinal} of {section.totalCount}
        </Text>
      </View>
      <View style={styles.factRow} testID="sidecar-active-path">
        <Text style={styles.factLabel}>Path</Text>
        <Text style={styles.factValue} numberOfLines={1}>
          {section.pathLabel}
        </Text>
      </View>
    </SectionShell>
  );
}

function SuggestedNextMove({ section }: { section: SidecarSection_SuggestedNextMove }) {
  return (
    <SectionShell testID="sidecar-section-suggested-next-move" title="Suggested next move">
      <Text style={styles.placeholderLine}>{section.placeholderLine}</Text>
    </SectionShell>
  );
}

function SemanticFlags({ section }: { section: SidecarSection_SemanticFlags }) {
  const [showAllInCondensed, setShowAllInCondensed] = useState(false);
  const showCondensed = section.isCondensed && !showAllInCondensed;

  return (
    <SectionShell testID="sidecar-section-semantic-flags" title="Semantic flags">
      {section.totalCount === 0 ? (
        <Text style={styles.emptyLine}>No flags on this move yet.</Text>
      ) : showCondensed ? (
        <View style={styles.condensedRow}>
          <Text style={styles.condensedCount} testID="sidecar-semantic-flags-count">
            {section.totalCount} {section.totalCount === 1 ? 'flag' : 'flags'}
          </Text>
          <Pressable
            onPress={() => setShowAllInCondensed(true)}
            accessibilityRole="button"
            accessibilityLabel="Show flag details"
            hitSlop={SHOW_DETAILS_HIT_SLOP}
            style={styles.showDetailsButton}
            testID="sidecar-semantic-flags-show-details"
          >
            <Text style={styles.showDetailsText}>Show details</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.chipsRow}>
          {section.chips.map((chip) => (
            <View key={chip.id} style={styles.chip} testID={`sidecar-flag-chip-${chip.id}`}>
              <Text style={styles.chipLabel}>{chip.label}</Text>
            </View>
          ))}
        </View>
      )}
    </SectionShell>
  );
}

// ── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#0b1220',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    padding: 10,
    maxHeight: 360,
  },
  empty: {
    padding: 16,
    backgroundColor: '#0b1220',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  emptyText: { color: '#64748b', fontSize: 12 },
  scroll: {},
  scrollContent: { paddingBottom: 8 },
  section: {
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  kind: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'capitalize' as const,
  },
  side: { color: '#94a3b8', fontSize: 12 },
  actor: { color: '#cbd5e1', fontSize: 12 },
  dot: { color: '#475569', fontSize: 12 },
  timestamp: { color: '#64748b', fontSize: 11, marginTop: 2 },
  body: { color: '#e5e7eb', fontSize: 14, lineHeight: 20, marginTop: 6 },
  hiddenNotice: { color: '#94a3b8', fontStyle: 'italic' as const, marginTop: 6, fontSize: 12 },
  parentBlock: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#475569',
  },
  parentLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase' as const,
  },
  parentPreview: { color: '#cbd5e1', fontSize: 12, marginTop: 2 },
  bandRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  bandChip: {
    flex: 1,
    backgroundColor: '#1f2937',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bandValue: { color: '#f8fafc', fontSize: 11 },
  lifecycleLabel: { color: '#f8fafc', fontSize: 13, fontWeight: '700' },
  lifecycleHelper: { color: '#cbd5e1', fontSize: 12, marginTop: 2, lineHeight: 16 },
  emptyLine: { color: '#64748b', fontSize: 12, fontStyle: 'italic' as const },
  unresolvedItem: { marginTop: 4 },
  unresolvedLabel: { color: '#f8fafc', fontSize: 12, fontWeight: '700' },
  unresolvedHelper: { color: '#cbd5e1', fontSize: 11, marginTop: 1 },
  factRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  factLabel: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  factValue: { color: '#e2e8f0', fontSize: 11 },
  placeholderLine: { color: '#94a3b8', fontSize: 12, fontStyle: 'italic' as const },
  condensedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  condensedCount: { color: '#e2e8f0', fontSize: 12, fontWeight: '700' },
  showDetailsButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 28,
    borderRadius: 8,
    backgroundColor: '#1f2937',
  },
  showDetailsText: { color: '#a5b4fc', fontSize: 11, fontWeight: '700' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#1f2937',
    borderRadius: 999,
  },
  chipLabel: { color: '#f8fafc', fontSize: 11, fontWeight: '600' },
});
