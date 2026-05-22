/**
 * QOL-032 — InspectPopout: the node & evidence detail popout.
 *
 * The second sibling that stands on the QOL-030 chassis (`Popout` /
 * `PopoutGroup` / `PopoutEntry`), beside Act (QOL-031) and Go (QOL-033).
 * The Inspect popout is the *understand* surface — a STRICTLY READ-ONLY
 * node / evidence / branch detail panel anchored to the selected node
 * (QOL-032 design §1 / §3).
 *
 * Layout (design §6 wireframe):
 *  - An optional one-line "settled" banner above §1, for an
 *    `archived_or_resolved` node (design §3.3).
 *  - The fixed seven-section set via `buildInspectPopout` — every section
 *    always present; the §3.3 stage-emphasised section is pulled to the top
 *    and expanded by default (design §3.2 / §3.3). Each section is a
 *    collapsible read-only detail row.
 *  - The §5 "Suggested next move" section carries the single hand-off chip
 *    → it closes Inspect and opens the Act popout at the named entry
 *    (design §4 / §5).
 *  - A `‹ prev   next ›` traversal row — wraps disabled at root / latest,
 *    consistent with IX-003 (design §6 / §7).
 *
 * Doctrine / accessibility (QOL-032 design §9, cdiscourse-doctrine,
 * timeline-grammar, accessibility-targets, evidence-doctrine):
 *  - STRICTLY READ-ONLY — Inspect never writes, never posts, never edits a
 *    body, never opens the box. The ONLY action affordance is the §5
 *    hand-off chip, which HANDS OFF to the Act popout (it fires
 *    `onHandoffToAct(actEntryId)`); Inspect itself opens nothing. The
 *    component imports no Supabase, no network, no AI, no router.
 *  - Plain language only — every rendered string comes from
 *    `inspectPopoutModel`, which is ban-list scanned. No raw `snake_case`
 *    reaches the screen.
 *  - No verdict / winner / loser / truth copy — the settled banner states
 *    the argument is "settled", never declares a result.
 *  - Heat, if shown, is labelled activity — the model authors no heat copy
 *    here; the host supplies §3/§4 content already framed as activity.
 *  - Deterministic pure projection — `InspectPopout` consumes the
 *    already-built section content; it re-derives nothing (design §2).
 *  - Every interactive row is a ≥ 44×44 `Pressable` with a role + label +
 *    `accessibilityState` (the chassis enforces this for the close
 *    control; the section-expand + traversal controls do it here).
 *
 * Presentational only — the pure logic is `inspectPopoutModel.ts`.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SURFACE_TOKENS, RADIUS, SPACING } from '../../../lib/designTokens';
import type { ActEntryId } from './actPopoutModel';
import { Popout } from './Popout';
import { PADDED_HIT_SLOP } from './PopoutEntry';
import {
  buildInspectPopout,
  INSPECT_SETTLED_BANNER,
  type BuildInspectPopoutInput,
  type InspectSection,
  type InspectSectionContent,
} from './inspectPopoutModel';
import type { PointLifecycleState } from '../../lifecycle';

// ── Props ──────────────────────────────────────────────────────

export interface InspectPopoutProps {
  /** Drives mount + the flash animation (the chassis owns the animation). */
  visible: boolean;
  /** Close the Inspect popout — bound to the close control, scrim, Esc, back. */
  onClose: () => void;
  /**
   * The selected node's LIFE-001 stage — drives the §3.3 emphasis + the §5
   * suggested move. `null` for a non-node target or when LIFE-001 is
   * unavailable (design §7 degraded fallback).
   */
  stage: PointLifecycleState | null;
  /**
   * The plain-language section content, supplied READ-ONLY by the host —
   * §1 body / §2 META-001 relation / §3 LIFE-001 + EV-003 / §4 BR-001/004
   * position / §6 RULE-001/003 flags / §E EV-001 evidence. Inspect RENDERS
   * these; it derives none of them (design §2).
   */
  content: InspectSectionContent;
  /**
   * True when the room is archived — the §5 hand-off chip renders disabled
   * with a reason; Inspect itself stays fully functional (design §7).
   */
  isArchivedRoom?: boolean;
  /**
   * Fired for the §5 hand-off chip — the host CLOSES Inspect and opens the
   * Act popout at `actEntryId` (design §4). Inspect never opens the box
   * itself. Never fired when the chip is disabled (archived room).
   */
  onHandoffToAct: (actEntryId: ActEntryId) => void;
  /**
   * Fired for the `‹ prev` traversal control — the host activates the
   * previous node and re-feeds Inspect. Omitted / `hasPrev=false` renders
   * the control disabled (no wrap at the root — design §7, IX-003).
   */
  onPrev?: () => void;
  /**
   * Fired for the `next ›` traversal control — the host activates the next
   * node. Omitted / `hasNext=false` renders the control disabled (no wrap
   * at the latest move — design §7, IX-003).
   */
  onNext?: () => void;
  /** True when a previous node exists — drives the `‹ prev` enabled state. */
  hasPrev?: boolean;
  /** True when a next node exists — drives the `next ›` enabled state. */
  hasNext?: boolean;
  /** PR-001 effective reduce-motion — threaded into the chassis. */
  reduceMotionOverride?: boolean;
  /** testID passthrough for the popout root. */
  testID?: string;
}

// ── Section row ────────────────────────────────────────────────

interface InspectSectionRowProps {
  section: InspectSection;
  /** True when the section is currently expanded (open). */
  isExpanded: boolean;
  /** Toggle the section open / closed. */
  onToggle: () => void;
  /**
   * The §5 hand-off chip — rendered inside the §5 `next_move` section only.
   * `null` for every other section.
   */
  handoffChip: React.ReactNode;
}

/**
 * One collapsible Inspect section. The header is a ≥ 44×44 `Pressable`
 * (`button` role, `expanded` state) that toggles the body; the emphasised
 * section opens expanded. A collapsed section is never hidden — it stays
 * in the list and the user can expand it (read-only detail, design §3.3).
 */
function InspectSectionRow({
  section,
  isExpanded,
  onToggle,
  handoffChip,
}: InspectSectionRowProps) {
  // A text caret carries the open / closed state without relying on color.
  const caret = isExpanded ? '▾' : '▸';
  // The emphasised section gets a leading marker (text + weight, not color).
  const marker = section.isEmphasized ? '◀ ' : '';

  return (
    <View
      style={[styles.section, section.isEmphasized && styles.sectionEmphasized]}
      testID={`inspect-popout-section-${section.id}`}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={section.accessibilityLabel}
        accessibilityState={{ expanded: isExpanded }}
        hitSlop={PADDED_HIT_SLOP}
        style={styles.sectionHeaderRow}
        testID={`inspect-popout-section-header-${section.id}`}
      >
        <Text
          style={styles.sectionCaret}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {caret}
        </Text>
        <Text
          style={[styles.sectionTitle, section.isEmphasized && styles.sectionTitleEmphasized]}
          numberOfLines={2}
        >
          {section.title}
        </Text>
        {section.isEmphasized ? (
          <Text
            style={styles.sectionMarker}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {marker.trim()}
          </Text>
        ) : null}
      </Pressable>

      {/* The section body — a read-only detail block. Shown when expanded;
          a collapsed section is never removed from the list. */}
      {isExpanded ? (
        <View style={styles.sectionBody} testID={`inspect-popout-section-body-${section.id}`}>
          <Text style={styles.sectionBodyText}>{section.body}</Text>
          {/* The §5 section additionally renders the single hand-off chip. */}
          {handoffChip}
        </View>
      ) : null}
    </View>
  );
}

// ── Component ──────────────────────────────────────────────────

/**
 * The Inspect popout — the fixed seven-section detail set on the QOL-030
 * chassis. The set is always complete; the §3.3 stage-emphasised section
 * is pulled to the top and expanded; the §5 chip hands off to Act. Inspect
 * writes nothing — it is the *understand* surface.
 */
export function InspectPopout({
  visible,
  onClose,
  stage,
  content,
  isArchivedRoom,
  onHandoffToAct,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  reduceMotionOverride,
  testID,
}: InspectPopoutProps) {
  // The fixed section set — `buildInspectPopout` resolves every section's
  // body, the §3.3 emphasis, the §5 hand-off, and the settled banner.
  // Inspect CONSUMES this; it re-derives nothing.
  const model = useMemo(() => {
    const buildInput: BuildInspectPopoutInput = {
      stage,
      content,
      isArchivedRoom: isArchivedRoom === true,
    };
    return buildInspectPopout(buildInput);
  }, [stage, content, isArchivedRoom]);

  // Per-section expand state, seeded from `isExpandedByDefault` — the
  // emphasised section opens expanded, the rest collapsed. The user can
  // expand any collapsed section (read-only detail is never hidden).
  const defaultExpanded = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const section of model.sections) {
      map[section.id] = section.isExpandedByDefault;
    }
    return map;
  }, [model]);

  const [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({});

  // The effective expand state — an override wins over the default.
  const isSectionExpanded = useCallback(
    (id: string): boolean => {
      if (id in expandedOverrides) return expandedOverrides[id];
      return defaultExpanded[id] === true;
    },
    [expandedOverrides, defaultExpanded],
  );

  const toggleSection = useCallback(
    (id: string) => {
      setExpandedOverrides((prev) => {
        const current = id in prev ? prev[id] : defaultExpanded[id] === true;
        return { ...prev, [id]: !current };
      });
    },
    [defaultExpanded],
  );

  /**
   * The §5 hand-off chip press — closes Inspect and opens the Act popout
   * at the named entry (design §4). Inspect never opens the box itself.
   * A disabled chip never reaches here.
   */
  const handleHandoff = useCallback(() => {
    if (model.handoff.isDisabled) return;
    onHandoffToAct(model.handoff.actEntryId);
    // The hand-off CLOSES Inspect — the *understand* surface yields to the
    // *do* surface (design §4 "closes Inspect and opens the Act popout").
    onClose();
  }, [model.handoff, onHandoffToAct, onClose]);

  // The §5 hand-off chip — rendered inside the §5 section's body. A
  // disabled chip (archived room) stays visible with its reason.
  const handoffChip = useMemo(() => {
    const { handoff } = model;
    return (
      <View style={styles.handoffWrap}>
        <Pressable
          onPress={handoff.isDisabled ? undefined : handleHandoff}
          disabled={handoff.isDisabled}
          accessibilityRole="button"
          accessibilityLabel={
            handoff.isDisabled
              ? `${handoff.chipLabel} (unavailable: ${handoff.disabledReason ?? ''})`
              : `${handoff.chipLabel}. Opens the Act menu.`
          }
          accessibilityState={{ disabled: handoff.isDisabled }}
          hitSlop={PADDED_HIT_SLOP}
          style={[styles.handoffChip, handoff.isDisabled && styles.handoffChipDisabled]}
          testID="inspect-popout-handoff-chip"
        >
          <Text
            style={[styles.handoffChipText, handoff.isDisabled && styles.textDisabled]}
            numberOfLines={2}
          >
            {handoff.chipLabel}
          </Text>
          {/* A trailing arrow signals the hand-off without relying on color. */}
          <Text
            style={[styles.handoffChipArrow, handoff.isDisabled && styles.textDisabled]}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            →
          </Text>
        </Pressable>
        {handoff.isDisabled && handoff.disabledReason ? (
          <Text style={styles.handoffDisabledReason} numberOfLines={2}>
            {handoff.disabledReason}
          </Text>
        ) : null}
      </View>
    );
  }, [model, handleHandoff]);

  // Traversal — `‹ prev` / `next ›`. Disabled (no wrap) at the ends,
  // consistent with IX-003 (design §7).
  const prevEnabled = hasPrev === true && typeof onPrev === 'function';
  const nextEnabled = hasNext === true && typeof onNext === 'function';

  const handlePrev = useCallback(() => {
    if (prevEnabled && onPrev) onPrev();
  }, [prevEnabled, onPrev]);

  const handleNext = useCallback(() => {
    if (nextEnabled && onNext) onNext();
  }, [nextEnabled, onNext]);

  return (
    <Popout
      visible={visible}
      title="Inspect"
      onClose={onClose}
      reduceMotionOverride={reduceMotionOverride}
      testID={testID ?? 'one-box-inspect-popout'}
    >
      {/* ── The settled banner — shown only for an archived / resolved
          node (design §3.3). States the argument is settled; never a
          verdict. ── */}
      {model.showsSettledBanner ? (
        <View style={styles.settledBanner} testID="inspect-popout-settled-banner">
          <Text style={styles.settledBannerText}>{INSPECT_SETTLED_BANNER}</Text>
        </View>
      ) : null}

      {/* ── The fixed seven-section set. Every section is always present;
          the §3.3 emphasised section is first + expanded. ── */}
      {model.sections.map((section) => (
        <InspectSectionRow
          key={section.id}
          section={section}
          isExpanded={isSectionExpanded(section.id)}
          onToggle={() => toggleSection(section.id)}
          handoffChip={section.id === 'next_move' ? handoffChip : null}
        />
      ))}

      {/* ── Traversal row — `‹ prev   next ›`. Wraps disabled at the ends,
          consistent with IX-003 (design §6 / §7). ── */}
      <View style={styles.traversalRow} testID="inspect-popout-traversal">
        <Pressable
          onPress={prevEnabled ? handlePrev : undefined}
          disabled={!prevEnabled}
          accessibilityRole="button"
          accessibilityLabel="Inspect the previous move"
          accessibilityState={{ disabled: !prevEnabled }}
          hitSlop={PADDED_HIT_SLOP}
          style={[styles.traversalButton, !prevEnabled && styles.traversalButtonDisabled]}
          testID="inspect-popout-prev"
        >
          <Text style={[styles.traversalText, !prevEnabled && styles.textDisabled]}>
            ‹ prev
          </Text>
        </Pressable>
        <Pressable
          onPress={nextEnabled ? handleNext : undefined}
          disabled={!nextEnabled}
          accessibilityRole="button"
          accessibilityLabel="Inspect the next move"
          accessibilityState={{ disabled: !nextEnabled }}
          hitSlop={PADDED_HIT_SLOP}
          style={[styles.traversalButton, !nextEnabled && styles.traversalButtonDisabled]}
          testID="inspect-popout-next"
        >
          <Text style={[styles.traversalText, !nextEnabled && styles.textDisabled]}>
            next ›
          </Text>
        </Pressable>
      </View>
    </Popout>
  );
}

const styles = StyleSheet.create({
  settledBanner: {
    marginHorizontal: SPACING.s,
    marginBottom: SPACING.s,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    backgroundColor: SURFACE_TOKENS.raised,
  },
  settledBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: SURFACE_TOKENS.textSecondary,
  },
  section: {
    marginHorizontal: SPACING.xs,
    marginVertical: 2,
    borderRadius: RADIUS.md,
  },
  sectionEmphasized: {
    // Emphasis is a raised surface + (below) heavier title text — not color.
    backgroundColor: SURFACE_TOKENS.raised,
  },
  sectionHeaderRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    gap: SPACING.s,
  },
  sectionCaret: {
    fontSize: 13,
    color: SURFACE_TOKENS.textSecondary,
    width: 18,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: SURFACE_TOKENS.textPrimary,
  },
  sectionTitleEmphasized: {
    fontWeight: '800',
  },
  sectionMarker: {
    fontSize: 12,
    fontWeight: '800',
    color: SURFACE_TOKENS.textSecondary,
  },
  sectionBody: {
    paddingHorizontal: SPACING.m + 18 + SPACING.s,
    paddingBottom: SPACING.s,
  },
  sectionBodyText: {
    fontSize: 13,
    lineHeight: 19,
    color: SURFACE_TOKENS.textSecondary,
  },
  handoffWrap: {
    marginTop: SPACING.s,
  },
  handoffChip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    backgroundColor: SURFACE_TOKENS.elevated,
    gap: SPACING.s,
  },
  handoffChipDisabled: {
    opacity: 0.55,
  },
  handoffChipText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: SURFACE_TOKENS.textPrimary,
  },
  handoffChipArrow: {
    fontSize: 15,
    fontWeight: '800',
    color: SURFACE_TOKENS.textSecondary,
  },
  handoffDisabledReason: {
    fontSize: 12,
    color: SURFACE_TOKENS.textMuted,
    paddingTop: SPACING.xs,
  },
  traversalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.s,
    marginHorizontal: SPACING.xs,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderTopWidth: 1,
    borderTopColor: SURFACE_TOKENS.border,
  },
  traversalButton: {
    minHeight: 44,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.m,
    borderRadius: RADIUS.md,
  },
  traversalButtonDisabled: {
    opacity: 0.4,
  },
  traversalText: {
    fontSize: 13,
    fontWeight: '700',
    color: SURFACE_TOKENS.textSecondary,
  },
  textDisabled: {
    color: SURFACE_TOKENS.textMuted,
  },
});
