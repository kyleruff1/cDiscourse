/**
 * CHIMEIN-P8 Round 2 (#761) — ChimeInAffordance.
 *
 * The flag-gated "Chime in on this point" control (design section 4.2 clause 1).
 * It turns the viewer OWN already-posted reply into a bounded, point-scoped
 * chime-in by calling attachChimeIn (and retractChimeIn to undo). The chime
 * CONTENT is the ordinary reply that already went through the byte-identical
 * submit-argument gate; this control only attaches/detaches the marker.
 *
 * BYTE-IDENTICAL when OFF / ineligible: with `chimeInEnabled` false, a private
 * room, an observer viewer, a principal viewer, someone else move, a root reply
 * with no point, or no open seat, this renders NULL. No featureFlags import (the
 * ASP consumer-allowlist guard — the flag arrives as a prop). Presentational: it
 * calls the caller-supplied onAttach / onRetract (the parent owns the api call +
 * refetch); it holds no network of its own.
 *
 * DOCTRINE (cdiscourse-doctrine sections 1 / 9): a chime-in is a bounded
 * contribution, never a third principal voice, never a node structural state,
 * never factual standing. Every string is plain language, ban-list clean.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  deriveChimeInContributionState,
  isChimeInArgument,
  type ChimeInContributionRow,
} from './chimeInContributionModel';

/** The viewer OWN posted reply that could become a chime-in. */
export interface ChimeInCandidate {
  argumentId: string;
  /** The point it attaches to (its parent). null => not point-scoped => ineligible. */
  parentId: string | null;
  authorId: string | null;
}

export interface ChimeInAffordanceProps {
  /** The chime_in flag, threaded from App.tsx. Absent / false => renders null. */
  chimeInEnabled?: boolean;
  roomVisibility?: 'public' | 'private' | null;
  viewerUserId: string | null;
  /** The viewer debate side. Observers / moderators cannot chime in. */
  viewerParticipantSide?: string | null;
  /** The two principals — a principal is never a chime-in. */
  initiatorUserId: string | null;
  primaryOpponentUserId: string | null;
  /** The candidate reply (typically the active message) the viewer might chime with. */
  candidate?: ChimeInCandidate | null;
  /** The loaded ACTIVE chime rows (from useChimeInContributions). */
  contributions?: ReadonlyArray<ChimeInContributionRow>;
  /** Called to attach the marker. The parent performs the api call + refetch. */
  onAttach: (input: { argumentId: string; targetArgumentId: string }) => void;
  /** Called to retract the marker. The parent performs the api call + refetch. */
  onRetract: (input: { argumentId: string }) => void;
  /** True while an attach / retract is in flight — disables the control. */
  busy?: boolean;
  /**
   * UX-PR-B (#918) — a quiet plain-language failure note (from the parent, fed
   * ChimeInApiResult.errorMessage, which already routes through CHIME_IN_ERROR_COPY).
   * When set it renders a live-region Text below the pill so a failed attach /
   * retract is announced instead of silently doing nothing. null / absent => no note.
   */
  note?: string | null;
  testID?: string;
}

export const CHIME_IN_AFFORDANCE_COPY = Object.freeze({
  attachLabel: 'Chime in on this point',
  attachA11y: 'Chime in on this point. Adds your reply as a bounded contribution.',
  retractLabel: 'Retract chime-in',
  retractA11y: 'Retract your chime-in on this point.',
});

const HIT_SLOP = { top: 11, bottom: 11, left: 8, right: 8 } as const;

/** True when the viewer is an eligible non-principal participant on their own point-scoped reply. */
function isEligible(props: ChimeInAffordanceProps): boolean {
  if (props.chimeInEnabled !== true) return false;
  if (props.roomVisibility !== 'public') return false;
  const viewer = props.viewerUserId;
  if (!viewer) return false;
  // A principal is never a chime-in.
  if (viewer === props.initiatorUserId || viewer === props.primaryOpponentUserId) return false;
  // Observers / moderators cannot chime in (they cannot post a side reply).
  if (props.viewerParticipantSide !== 'affirmative' && props.viewerParticipantSide !== 'negative') {
    return false;
  }
  const candidate = props.candidate;
  if (!candidate) return false;
  // Author-scoped: only the viewer own reply.
  if (candidate.authorId !== viewer) return false;
  // Point-scoped: the reply must attach to a parent point.
  if (!candidate.parentId) return false;
  return true;
}

export function ChimeInAffordance(props: ChimeInAffordanceProps): React.ReactElement | null {
  if (!isEligible(props)) return null;
  const candidate = props.candidate as ChimeInCandidate;
  const parentId = candidate.parentId as string;

  const state = deriveChimeInContributionState(props.contributions ?? []);
  const alreadyChimed = isChimeInArgument(state, candidate.argumentId);

  // Not chimed + no open seat => nothing to offer (the rail chip shows the count).
  if (!alreadyChimed && state.openChimeInSeatCount <= 0) return null;

  const busy = props.busy === true;
  const base = props.testID ?? 'chime-in-affordance';

  // UX-PR-B (#918) — the quiet failure note, live-region announced, below the
  // pill. Only rendered in the eligible / attached states (this render path),
  // which is exactly where an attach / retract could have failed.
  const noteEl = props.note ? (
    <Text style={styles.note} accessibilityLiveRegion="polite" testID={`${base}-note`}>
      {props.note}
    </Text>
  ) : null;

  if (alreadyChimed) {
    return (
      <View style={styles.wrap} testID={base}>
        <Pressable
          onPress={() => props.onRetract({ argumentId: candidate.argumentId })}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={CHIME_IN_AFFORDANCE_COPY.retractA11y}
          accessibilityState={{ disabled: busy, selected: true }}
          hitSlop={HIT_SLOP}
          style={[styles.pill, styles.pillActive, busy && styles.pillBusy]}
          testID="chime-in-affordance-retract"
        >
          <Text style={styles.glyph} accessibilityElementsHidden>
            {'◇'}
          </Text>
          <Text style={styles.pillTextActive}>{CHIME_IN_AFFORDANCE_COPY.retractLabel}</Text>
        </Pressable>
        {noteEl}
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID={base}>
      <Pressable
        onPress={() => props.onAttach({ argumentId: candidate.argumentId, targetArgumentId: parentId })}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={CHIME_IN_AFFORDANCE_COPY.attachA11y}
        accessibilityState={{ disabled: busy, selected: false }}
        hitSlop={HIT_SLOP}
        style={[styles.pill, busy && styles.pillBusy]}
        testID="chime-in-affordance-attach"
      >
        <Text style={styles.glyph} accessibilityElementsHidden>
          {'◇'}
        </Text>
        <Text style={styles.pillText}>{CHIME_IN_AFFORDANCE_COPY.attachLabel}</Text>
      </Pressable>
      {noteEl}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 6,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  // UX-PR-B (#918) — quiet failure note beneath the pill (mirrors the
  // BooleanFeedbackBar errorNote tone).
  note: {
    marginTop: 6,
    color: '#94a3b8',
    fontSize: 11,
    fontStyle: 'italic',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  pillActive: {
    borderColor: '#2563eb',
    borderWidth: 2,
    backgroundColor: '#eff6ff',
  },
  pillBusy: {
    opacity: 0.5,
  },
  glyph: {
    fontSize: 12,
    color: '#4b5563',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  pillTextActive: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
});
