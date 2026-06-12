/**
 * Stage 6.1.8 — ArgumentBubbleCard
 *
 * One card in the Stack or one expanded marker in the Timeline. Always
 * displays:
 *   - kind label + side label
 *   - body (already redacted upstream)
 *   - absolute + relative timestamp as two stacked Texts (never prose-joined)
 *   - parent hint when available
 *   - qualifier badges
 *   - point-standing/resting-status hint
 *
 * Never exposes message-body editing. Own bubbles never show edit affordances.
 *
 * CARD-VIEW-DATA-001 — the ACTIVE card becomes the data-rich centerpiece.
 * When `vm.isActive` AND a `cardDetail` model is supplied, the exploded
 * Inspect detail (`CardDetailPanel`) renders inline BY DEFAULT (no tap):
 * step reference, category/qualifier, classifier observations, evidence,
 * standing, lifecycle, and semantic-flag labels. Non-active stacked cards
 * stay compact (3-line) and ignore the prop. The prop is optional → older
 * callers (Timeline expanded-marker use, tests) render byte-equivalently.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ArgumentBubbleViewModel } from './argumentGameSurfaceModel';
import { CardDetailPanel } from './cardView/CardDetailPanel';
import type { CardDetailViewModel } from './cardView/cardDetailModel';
import type { CardMappingSectionModel } from './cardView/cardMappingSectionModel';
import type { RailActionCode, RailViewerRole } from './railActionCategories';
import type { DisagreementContract, MoveSuggestion } from '../refereeLoop';
import type { RefereeNavVerb } from './cardView/RefereeCardView';

interface Props {
  viewModel: ArgumentBubbleViewModel;
  onActivate?: (messageId: string) => void;
  onToggleMode?: () => void;
  compact?: boolean;
  /** CARD-VIEW-DATA-001 — exploded detail model; rendered only when isActive. */
  cardDetail?: CardDetailViewModel | null;
  /** MCP-MAPPING-EXPANSION-001 (Slice B) — combination-observations section
   *  model; forwarded to the active card's CardDetailPanel. Omitted → no
   *  section (byte-equivalent to the pre-Slice-B card). */
  mappingSection?: CardMappingSectionModel | null;
  /** CARD-VIEW-DATA-001 — re-activates the step-ref ancestor on token tap. */
  onActivateAncestor?: (messageId: string) => void;
  /** CVDH-001 Slice 3 — viewport width for the hub's responsive multi-column
   *  layout. Forwarded to the active card's CardDetailPanel. */
  windowWidth?: number;
  /** CARD-VIEW-REFINE-001 — measured stage height (px). When present on the
   *  active card the card clips + scrolls its detail within this bound so a
   *  tall panel never overflows the stage. null/undefined → unbounded
   *  (legacy / non-active). */
  maxHeight?: number | null;
  /** CARD-VIEW-REFINE-001 — viewer role for the inline ActionsZone (active
   *  card only). Forwarded to CardDetailPanel; absent → no ActionsZone. */
  viewerRole?: RailViewerRole;
  /** CARD-VIEW-REFINE-001 — dispatch a rail action code for this message via
   *  the SAME path the side rail uses. Forwarded to the panel's inline
   *  ActionsZone; absent → no ActionsZone. */
  onRailAction?: (code: RailActionCode, ctx: { activeMessageId: string | null }) => void;
  /** REF-003 — derived Open Issue for the active node. Forwarded into the
   *  CardDetailPanel's Referee Card slot ONLY when showCardDetail (active
   *  card). Omitted / non-active → no Referee Card. */
  refereeCard?: DisagreementContract | null;
  /** REF-003 — zone-3 move dispatch; bound to this card's messageId, mirroring
   *  the onRailAction closure. */
  onRefereeMove?: (move: MoveSuggestion, ctx: { activeMessageId: string | null }) => void;
  /** REF-004 — Referee Card navigation verbs (Inspect / Focus on board); bound
   *  to this card's messageId exactly as onRefereeMove. */
  onRefereeNavigate?: (verb: RefereeNavVerb, ctx: { activeMessageId: string | null }) => void;
}

export function ArgumentBubbleCard({
  viewModel: vm,
  onActivate,
  onToggleMode,
  compact,
  cardDetail,
  mappingSection,
  onActivateAncestor,
  windowWidth,
  maxHeight,
  viewerRole,
  onRailAction,
  refereeCard,
  onRefereeMove,
  onRefereeNavigate,
}: Props) {
  const isOwn = vm.actor === 'self';
  // CARD-VIEW-DATA-001 — the exploded detail renders only on the active
  // card, visible by default. Stacked (non-active) cards stay 3-line
  // compact and ignore the detail prop.
  const showCardDetail = vm.isActive && cardDetail != null;
  // CARD-VIEW-REFINE-001 — bound the ACTIVE card by the measured stage
  // height so a tall always-visible detail panel scrolls inside the card
  // instead of overflowing top + bottom into the masthead. Only applied
  // when both active AND a finite bound is supplied (else unbounded =
  // legacy behavior). overflow:'hidden' clips to the rounded card.
  const boundActive =
    vm.isActive && typeof maxHeight === 'number' && Number.isFinite(maxHeight) && maxHeight > 0;

  return (
    <Pressable
      style={[
        styles.card,
        vm.isActive && styles.cardActive,
        isOwn && styles.cardOwn,
        boundActive && { maxHeight: maxHeight as number, overflow: 'hidden' },
      ]}
      onPress={() => onActivate?.(vm.messageId)}
      onLongPress={() => onToggleMode?.()}
      accessibilityRole="button"
      accessibilityState={{ selected: vm.isActive }}
      accessibilityLabel={`Message ${vm.ordinal}: ${vm.kindLabel}${vm.isLatest ? ' (latest)' : ''}`}
      testID={`argument-bubble-${vm.messageId}`}
    >
      <View style={styles.headerRow}>
        <View style={[styles.kindPill, isOwn && styles.kindPillOwn]}>
          <Text style={[styles.kindPillText, isOwn && styles.kindPillTextOwn]}>{vm.kindLabel}</Text>
        </View>
        <View style={styles.sidePill}>
          <Text style={styles.sidePillText}>{vm.sideLabel}</Text>
        </View>
        {vm.isLatest && (
          <View style={styles.latestPill} accessibilityLabel="latest-message-badge">
            <Text style={styles.latestPillText}>Latest</Text>
          </View>
        )}
      </View>

      {/* CARD-VIEW-DATA-001 — the step-reference header (inside the detail
          panel) supersedes the terse legacy parentHint on the active card.
          Non-active cards keep the legacy hint. */}
      {!showCardDetail && vm.parentHint && (
        <Text style={styles.parentHint} numberOfLines={1} testID={`bubble-parent-hint-${vm.messageId}`}>
          {vm.parentHint}
        </Text>
      )}

      {/* CARD-VIEW-COMPARISON-POLISH-001 — when the detail panel renders, the
          current/own message body is forwarded INTO the panel so the panel
          owns the vertical order (top parent "replying-to" bubble → current
          message body + observations). The card's own body line is therefore
          suppressed in that case to avoid a duplicate above the parent bubble.
          Non-active / panel-absent cards keep the inline body line. */}
      {!showCardDetail && (
        <Text style={[styles.body, compact && styles.bodyCompact]} numberOfLines={compact ? 3 : undefined} testID={`bubble-body-${vm.messageId}`}>
          {vm.body}
        </Text>
      )}

      {/* CARD-VIEW-DATA-001 — exploded Inspect detail, visible by default on
          the active card. Its category/qualifier + standing zones supersede
          the legacy badge row (rendered only when the panel is absent).
          CARD-VIEW-REFINE-001 — the panel is wrapped in a ScrollView so the
          always-visible detail SCROLLS WITHIN the bounded card (containment,
          NOT a tap-to-reveal disclosure — every section still renders without
          a tap; check #14 holds). `flexShrink:1` lets the scroll region give
          up space to the header + time block within the maxHeight bound. */}
      {showCardDetail ? (
        <ScrollView
          style={boundActive ? styles.detailScroll : undefined}
          contentContainerStyle={styles.detailScrollContent}
          showsVerticalScrollIndicator
          testID={`card-detail-scroll-${vm.messageId}`}
        >
          <CardDetailPanel
            model={cardDetail!}
            mappingSection={mappingSection}
            onActivateAncestor={onActivateAncestor}
            windowWidth={windowWidth}
            currentMessageBody={vm.body}
            viewerRole={viewerRole}
            bubbleActor={vm.actor}
            onRailAction={
              onRailAction
                ? (code) => onRailAction(code, { activeMessageId: vm.messageId })
                : undefined
            }
            // REF-003 — the active node's derived issue + its zone-3 move
            // dispatch, bound to this card's messageId exactly as onRailAction.
            refereeCard={refereeCard ?? null}
            onRefereeMove={
              onRefereeMove
                ? (move) => onRefereeMove(move, { activeMessageId: vm.messageId })
                : undefined
            }
            // REF-004 — Inspect / Focus-on-board verbs, bound to this card's
            // messageId exactly as onRefereeMove.
            onRefereeNavigate={
              onRefereeNavigate
                ? (verb) => onRefereeNavigate(verb, { activeMessageId: vm.messageId })
                : undefined
            }
            testID={`card-detail-panel-${vm.messageId}`}
          />
        </ScrollView>
      ) : (
        (vm.qualifierBadges.length > 0 || vm.pointStandingHint) && (
          <View style={styles.badgeRow}>
            {vm.qualifierBadges.map((b, i) => (
              <View key={`${b}-${i}`} style={styles.badge}>
                <Text style={styles.badgeText}>{b}</Text>
              </View>
            ))}
            {vm.pointStandingHint && (
              <View style={[styles.badge, styles.badgePointStanding]}>
                <Text style={styles.badgeText}>{vm.pointStandingHint}</Text>
              </View>
            )}
          </View>
        )
      )}

      <View style={styles.timeBlock} accessibilityLabel={`bubble-time-${vm.messageId}`}>
        <Text style={styles.timeAbsolute}>{vm.createdAtLabel}</Text>
        <Text style={styles.timeRelative}>{vm.relativeLabel}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minWidth: 240,
    maxWidth: 460,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardActive: { borderColor: '#818cf8', backgroundColor: '#111c39' },
  cardOwn: { borderColor: '#22d3ee' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  kindPill: { backgroundColor: '#1e293b', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  kindPillOwn: { backgroundColor: '#155e75' },
  kindPillText: { color: '#cbd5e1', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  kindPillTextOwn: { color: '#ecfeff' },
  sidePill: { backgroundColor: '#312e81', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  sidePillText: { color: '#e0e7ff', fontSize: 10, fontWeight: '700' },
  latestPill: { marginLeft: 'auto', backgroundColor: '#0e7490', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  latestPillText: { color: '#ecfeff', fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  parentHint: { color: '#94a3b8', fontSize: 11, fontStyle: 'italic', marginBottom: 4 },
  body: { color: '#f8fafc', fontSize: 15, lineHeight: 22 },
  bodyCompact: { fontSize: 13, lineHeight: 18 },
  // CARD-VIEW-REFINE-001 — the scroll region for the always-visible detail
  // panel on a bounded active card. flexShrink lets it yield to the header +
  // time block; the maxHeight bound lives on the card itself.
  detailScroll: { flexShrink: 1, alignSelf: 'stretch' },
  detailScrollContent: { flexGrow: 0 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  badge: { backgroundColor: '#1f2937', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgePointStanding: { backgroundColor: '#3b0764' },
  badgeText: { color: '#cbd5e1', fontSize: 10, fontWeight: '600' },
  timeBlock: { marginTop: 10 },
  timeAbsolute: { color: '#e2e8f0', fontSize: 11, fontVariant: ['tabular-nums'] as ['tabular-nums'] },
  timeRelative: { color: '#94a3b8', fontSize: 10 },
});
