/**
 * UX-NEXT-MOVE-001 — "What would move this forward?" card (Inspect drawer).
 *
 * A small, pure, READ-ONLY presentational card rendered in the existing
 * `SelectedNodeInspectDrawer` "Move forward:" slot. It shows the ordered set of
 * STRUCTURAL next moves for the active node's mediator display state (from
 * `nextMovesForState`) — the dominant move first, then the alternates.
 *
 * Doctrine (cdiscourse-doctrine §1/§2/§3/§4/§9/§10a):
 *   - It shows ACTIONS that could improve the SHAPE of the disagreement, never
 *     a conclusion: who is right / won / true / credible, or what anyone
 *     intended. The title is exactly "What would move this forward?".
 *   - It gates nothing — it imports nothing from the engine, makes no network
 *     call, and returns no posting decision. The deterministic Constitution
 *     engine stays the sole acceptance gate.
 *   - Guidance-only in v1: `onSelectMove` is OPTIONAL. When undefined (the safe
 *     default) every row renders as a guidance label — no tappable chooser.
 *     A discrete chooser with new action semantics is UX-NEXT-MOVE-002.
 *   - A move whose underlying pathway step is not actionable now
 *     (`available: false`) ALWAYS renders as guidance `<Text>`, never a
 *     pressable, regardless of `onSelectMove` — it routes to no action.
 *
 * RN primitives only (`View` / `Text` / `Pressable`); reuses existing tokens
 * (no new hex). Actionable rows are `accessibilityRole="button"` with a label
 * and a 44×44 hit target (`hitSlop`). The title is `accessibilityRole="header"`.
 * Renders `null` for an empty move list (mirrors the one-chip suppression).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BORDER_WIDTH,
  RADIUS,
  SPACING,
  SURFACE_TOKENS,
  TOUCH_TARGET,
  TYPOGRAPHY,
} from '../../lib/designTokens';
import type { ResolutionPathwayStepCode } from './mediatorBoardTypes';
import type { NextMove } from './nextMovesForState';

export interface MediatorNextMovesCardProps {
  /** From `nextMovesForState(displayState)`; empty → renders null. */
  moves: ReadonlyArray<NextMove>;
  /**
   * Optional. The host routes the stepCode to an EXISTING action. Undefined →
   * guidance-only (the safe default): rows render as labels, none route.
   */
  onSelectMove?: (stepCode: ResolutionPathwayStepCode) => void;
  testID?: string;
}

/**
 * The structure-only lead (O-2: token-free — avoids the ban-list tokens the
 * design-export lead would have named inside a negation). It frames the rows as
 * actions on the SHAPE of the disagreement, never as conclusions.
 */
const LEAD_LINE = 'These are actions that could move the shape of the disagreement forward — not conclusions.';

export function MediatorNextMovesCard({
  moves,
  onSelectMove,
  testID,
}: MediatorNextMovesCardProps): React.ReactElement | null {
  if (!moves || moves.length === 0) return null;

  const baseTestID = testID ?? 'mediator-next-moves-card';

  return (
    <View style={styles.card} testID={baseTestID}>
      <Text
        style={styles.title}
        accessibilityRole="header"
        testID={`${baseTestID}-title`}
      >
        What would move this forward?
      </Text>
      <Text style={styles.lead} accessibilityRole="text" testID={`${baseTestID}-lead`}>
        {LEAD_LINE}
      </Text>
      <View style={styles.moveList}>
        {moves.map((move) => (
          <MoveRow
            key={move.id}
            move={move}
            onSelectMove={onSelectMove}
            testID={`${baseTestID}-move-${move.id}`}
          />
        ))}
      </View>
    </View>
  );
}

interface MoveRowProps {
  move: NextMove;
  onSelectMove?: (stepCode: ResolutionPathwayStepCode) => void;
  testID: string;
}

/**
 * One move row. Actionable + a handler supplied → a `Pressable` (role=button,
 * 44×44 hit target). Otherwise a non-pressable `<Text>` block: an unavailable
 * move is ALWAYS guidance, and an available move with no handler reads as a
 * guidance label (the safe guidance-only default).
 */
function MoveRow({ move, onSelectMove, testID }: MoveRowProps): React.ReactElement {
  const isActionable = move.available && typeof onSelectMove === 'function';

  const body = (
    <>
      <Text
        style={[styles.moveLabel, move.isDominant && styles.moveLabelDominant]}
        accessibilityRole="text"
        testID={`${testID}-label`}
      >
        {move.label}
      </Text>
      <Text style={styles.moveRationale} accessibilityRole="text">
        {move.rationale}
      </Text>
    </>
  );

  if (isActionable) {
    return (
      <Pressable
        onPress={() => onSelectMove?.(move.stepCode)}
        accessibilityRole="button"
        accessibilityLabel={move.label}
        accessibilityHint={move.rationale}
        hitSlop={TOUCH_TARGET.hitSlopAll}
        style={[styles.moveRow, styles.moveRowActionable, move.isDominant && styles.moveRowDominant]}
        testID={testID}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.moveRow, move.isDominant && styles.moveRowDominant]}
      testID={testID}
    >
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: SPACING.xs,
  },
  title: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.popoutHeading.fontSize,
    lineHeight: TYPOGRAPHY.popoutHeading.lineHeight,
    fontWeight: '800',
  },
  lead: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.inspectDetail.fontSize,
    lineHeight: TYPOGRAPHY.inspectDetail.lineHeight,
    fontWeight: '400',
    marginTop: SPACING.xs,
    marginBottom: SPACING.s,
  },
  moveList: {
    // Rows stack vertically (no chip soup, no horizontal overflow at 390px).
  },
  moveRow: {
    marginBottom: SPACING.s,
    minHeight: TOUCH_TARGET.minSizePx,
    justifyContent: 'center',
    backgroundColor: SURFACE_TOKENS.elevated,
    borderWidth: BORDER_WIDTH.sm,
    borderColor: SURFACE_TOKENS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.xs,
  },
  // Geometry (a left rule), not color alone, marks the dominant move so it
  // reads first even in grayscale.
  moveRowDominant: {
    borderLeftWidth: BORDER_WIDTH.lg,
    borderLeftColor: SURFACE_TOKENS.focusRing,
  },
  moveRowActionable: {
    borderColor: SURFACE_TOKENS.inputBorder,
  },
  moveLabel: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: TYPOGRAPHY.chipLabel.fontSize,
    lineHeight: TYPOGRAPHY.chipLabel.lineHeight,
    fontWeight: '600',
  },
  moveLabelDominant: {
    fontWeight: '800',
  },
  moveRationale: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.inspectDetail.fontSize,
    lineHeight: TYPOGRAPHY.inspectDetail.lineHeight,
    fontWeight: '400',
    marginTop: SPACING.xs,
  },
});
