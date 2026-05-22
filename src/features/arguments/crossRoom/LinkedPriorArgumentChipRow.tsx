/**
 * QOL-042 — Linked prior argument context-chip row (presentational).
 *
 * Renders the room-level "this argument has prior context" affordance in
 * the timeline header / context row of the NEW (source) room, above the
 * horizontal rail. A room may carry more than one link chip — they wrap
 * into a horizontal chip row (QOL-042 design §6.1 / §6.2).
 *
 * The chip view-models are built by the pure `buildLinkedPriorArgumentChip`
 * model; this component only RENDERS them. It performs no fetch, makes no
 * access decision, and writes nothing.
 *
 * Accessibility (accessibility-targets, QOL-042 design §6.2):
 *   - Every action is a `<Pressable>` with `accessibilityRole="button"`,
 *     a verbose `accessibilityLabel`, and `accessibilityState`.
 *   - A disabled "Open" action shows a VISIBLE reason and reports
 *     `accessibilityState={{ disabled: true }}` — never a silent omission.
 *   - 44×44 hit target via `hitSlop` on the compact action buttons.
 *   - Colour is never the only signal — the ⤴ glyph + the header text +
 *     the lock-line text carry meaning without colour.
 *
 * No new dependency — RN primitives only.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type {
  LinkedPriorArgumentChip,
  LinkedPriorChipAction,
} from './linkedPriorArgumentModel';

interface Props {
  /** The chip view-models, in `created_at ASC` order (design §8). */
  chips: ReadonlyArray<LinkedPriorArgumentChip>;
  /** Open the prior (settled, read-only) argument room for a link. */
  onOpenPrior?: (linkId: string) => void;
  /** Open the Inspect popout's "From the linked prior argument" section. */
  onViewContext?: (linkId: string) => void;
}

/** 44×44 hit target for the compact action buttons (design / a11y). */
const ACTION_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

function ChipAction({
  action,
  linkId,
  onOpenPrior,
  onViewContext,
}: {
  action: LinkedPriorChipAction;
  linkId: string;
  onOpenPrior?: (linkId: string) => void;
  onViewContext?: (linkId: string) => void;
}) {
  const handlePress = () => {
    if (action.isDisabled) return;
    if (action.id === 'open_prior') onOpenPrior?.(linkId);
    else if (action.id === 'view_context') onViewContext?.(linkId);
  };
  return (
    <Pressable
      onPress={handlePress}
      disabled={action.isDisabled}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel}
      accessibilityState={{ disabled: action.isDisabled }}
      hitSlop={ACTION_HIT_SLOP}
      testID={`linked-prior-action-${action.id}-${linkId}`}
      style={[styles.actionBtn, action.isDisabled && styles.actionBtnDisabled]}
    >
      <Text
        style={[styles.actionBtnText, action.isDisabled && styles.actionBtnTextDisabled]}
        numberOfLines={1}
      >
        {action.label}
      </Text>
    </Pressable>
  );
}

function LinkedPriorChip({
  chip,
  onOpenPrior,
  onViewContext,
}: {
  chip: LinkedPriorArgumentChip;
  onOpenPrior?: (linkId: string) => void;
  onViewContext?: (linkId: string) => void;
}) {
  // State C — unavailable: a single neutral line, no title, no actions.
  if (chip.accessState === 'unavailable') {
    return (
      <View
        style={[styles.chip, styles.chipUnavailable]}
        accessibilityLabel={chip.accessibilityLabel}
        testID={`linked-prior-chip-${chip.linkId}`}
      >
        <Text style={styles.unavailableText} numberOfLines={2}>
          <Text style={styles.glyph}>⤴ </Text>
          {chip.header}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={styles.chip}
      accessibilityLabel={chip.accessibilityLabel}
      testID={`linked-prior-chip-${chip.linkId}`}
    >
      <Text style={styles.header} numberOfLines={1}>
        <Text style={styles.glyph}>⤴ </Text>
        {chip.header}
      </Text>
      <Text style={styles.title} numberOfLines={2} testID={`linked-prior-title-${chip.linkId}`}>
        “{chip.title}”
      </Text>
      {chip.subLine.length > 0 ? (
        <Text
          style={[
            styles.subLine,
            chip.accessState === 'title_only' && styles.subLineLock,
          ]}
          numberOfLines={2}
          testID={`linked-prior-subline-${chip.linkId}`}
        >
          {chip.accessState === 'title_only' ? '🔒 ' : ''}
          {chip.subLine}
        </Text>
      ) : null}
      {chip.note.length > 0 ? (
        <Text style={styles.note} numberOfLines={2} testID={`linked-prior-note-${chip.linkId}`}>
          {chip.note}
        </Text>
      ) : null}
      {chip.actions.length > 0 ? (
        <View style={styles.actionRow}>
          {chip.actions.map((action) => (
            <ChipAction
              key={`${chip.linkId}-${action.id}`}
              action={action}
              linkId={chip.linkId}
              onOpenPrior={onOpenPrior}
              onViewContext={onViewContext}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The linked-prior-argument chip row. Renders nothing when there are no
 * chips — additive, never crowds a room without prior context.
 */
export function LinkedPriorArgumentChipRow({ chips, onOpenPrior, onViewContext }: Props) {
  if (!chips || chips.length === 0) return null;
  return (
    <View style={styles.row} testID="linked-prior-chip-row">
      {chips.map((chip) => (
        <LinkedPriorChip
          key={chip.linkId}
          chip={chip}
          onOpenPrior={onOpenPrior}
          onViewContext={onViewContext}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#0b1220',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  chip: {
    minWidth: 200,
    maxWidth: 320,
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 240,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipUnavailable: {
    backgroundColor: '#0f172a',
    borderStyle: 'dashed' as const,
  },
  glyph: { color: '#a5b4fc', fontWeight: '800' },
  header: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  title: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  subLine: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 3,
  },
  subLineLock: {
    color: '#cbd5e1',
  },
  note: {
    color: '#64748b',
    fontSize: 11,
    fontStyle: 'italic' as const,
    marginTop: 3,
  },
  unavailableText: {
    color: '#64748b',
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  actionBtn: {
    backgroundColor: '#312e81',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    minHeight: 32,
    justifyContent: 'center',
  },
  actionBtnDisabled: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionBtnText: {
    color: '#e0e7ff',
    fontSize: 11,
    fontWeight: '700',
  },
  actionBtnTextDisabled: {
    color: '#64748b',
  },
});
