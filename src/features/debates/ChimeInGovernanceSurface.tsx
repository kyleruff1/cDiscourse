/**
 * CHIMEIN-P8 Round 2 (#761) — ChimeInGovernanceSurface.
 *
 * The flag-gated ACTIVATION wrapper for the (previously dormant, mounted-nowhere)
 * GAME-005 ChimeInGovernanceControl + useChimeInGovernance hook. It renders the
 * small governance control — shown ONLY to the two primary parties — for each
 * active chime-in in the room, driven by the loaded chime_in_contributions rows
 * (the Round-2 persisted marker).
 *
 * BYTE-IDENTICAL when OFF: with `chimeInEnabled` false (the default), or when the
 * viewer is not a primary party, or when there is no active chime-in, this renders
 * NULL — exactly the pre-Round-2 dormant state (the control was mounted nowhere).
 * No featureFlags import (the ASP consumer-allowlist guard — the flag arrives as a
 * prop). No network, no write path of its own: the governance reactions are the
 * in-session useChimeInGovernance state (persistence is a separate future card).
 *
 * DOCTRINE (cdiscourse-doctrine sections 1 / 10a): a governance reaction describes
 * participation STRUCTURE, never correctness; a chime-in is a bounded contribution,
 * never a third principal voice. The control activation adds NO verdict and NO
 * score — it surfaces the shipped, ban-list-clean GAME-005 reaction vocabulary.
 */
import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { ChimeInGovernanceControl } from './ChimeInGovernanceControl';
import { useChimeInGovernance } from './useChimeInGovernance';
import {
  buildGovernanceControlViewModel,
  type PublicRoomSeatMap,
  type GovernanceReactionKind,
} from './publicSeatModel';
import type { ChimeInContributionRow } from './chimeInContributionModel';

export interface ChimeInGovernanceSurfaceProps {
  /** The chime_in flag, threaded from App.tsx. Absent / false => renders null. */
  chimeInEnabled?: boolean;
  /** The loaded ACTIVE chime rows (from useChimeInContributions). */
  contributions?: ReadonlyArray<ChimeInContributionRow>;
  /** The two primary parties, from the room contract. */
  initiatorUserId: string | null;
  primaryOpponentUserId: string | null;
  /** The viewer. Only a primary party sees the governance control. */
  viewerUserId: string | null;
  testID?: string;
}

/** buildGovernanceControlViewModel reads only seatMap.movedToObserver; the chime
 *  reactions here are in-session so no governance-fallback is tracked. A minimal
 *  empty seat map keeps the view-model builder honest (observerFallbackNotice null). */
const EMPTY_SEAT_MAP: PublicRoomSeatMap = Object.freeze({
  roomId: '',
  activeSeats: Object.freeze([]),
  movedToObserver: Object.freeze([]),
  isCapReached: false,
  openChimeInSeatCount: 0,
});

interface ChimeInTarget {
  chimeInUserId: string;
  /** A stable id for the reaction target (the first chime content of this author). */
  branchOrMessageId: string;
}

export function ChimeInGovernanceSurface({
  chimeInEnabled,
  contributions,
  initiatorUserId,
  primaryOpponentUserId,
  viewerUserId,
  testID,
}: ChimeInGovernanceSurfaceProps): React.ReactElement | null {
  // Hooks run unconditionally (React rules) — the gating happens after.
  const governance = useChimeInGovernance();

  const viewerPrimarySeat: 'initiator' | 'primary_opponent' | null = useMemo(() => {
    if (viewerUserId && viewerUserId === initiatorUserId) return 'initiator';
    if (viewerUserId && primaryOpponentUserId && viewerUserId === primaryOpponentUserId) {
      return 'primary_opponent';
    }
    return null;
  }, [viewerUserId, initiatorUserId, primaryOpponentUserId]);

  // Distinct chime-in authors (never a primary), each with a stable target id.
  const targets: ChimeInTarget[] = useMemo(() => {
    if (!Array.isArray(contributions)) return [];
    const seen = new Set<string>();
    const out: ChimeInTarget[] = [];
    const active = contributions
      .filter((c) => c && c.retractedAt == null)
      .slice()
      .sort((a, b) => a.seatIndex - b.seatIndex);
    for (const row of active) {
      const author = row.authorId;
      if (!author || author === initiatorUserId || author === primaryOpponentUserId) continue;
      if (seen.has(author)) continue;
      seen.add(author);
      out.push({ chimeInUserId: author, branchOrMessageId: row.argumentId });
    }
    return out;
  }, [contributions, initiatorUserId, primaryOpponentUserId]);

  // GATE — byte-identical dormant (null) when the flag is off, the viewer is not a
  // primary party, or there is no chime-in to govern.
  if (chimeInEnabled !== true) return null;
  if (viewerPrimarySeat === null || !viewerUserId) return null;
  if (targets.length === 0) return null;

  return (
    <View style={styles.surface} testID={testID ?? 'chime-in-governance-surface'}>
      {targets.map((target) => {
        const viewModel = buildGovernanceControlViewModel({
          seatMap: EMPTY_SEAT_MAP,
          targetChimeInUserId: target.chimeInUserId,
          targetBranchId: target.branchOrMessageId,
          viewerUserId,
          governanceReactions: governance.reactions,
        });
        const onToggleReaction = (kind: GovernanceReactionKind): void => {
          governance.toggle({
            byPrimarySeat: viewerPrimarySeat,
            byUserId: viewerUserId,
            targetBranchOrMessageId: target.branchOrMessageId,
            targetChimeInUserId: target.chimeInUserId,
            kind,
            at: new Date().toISOString(),
          });
        };
        return (
          <ChimeInGovernanceControl
            key={target.chimeInUserId}
            viewModel={viewModel}
            onToggleReaction={onToggleReaction}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    gap: 6,
  },
});
