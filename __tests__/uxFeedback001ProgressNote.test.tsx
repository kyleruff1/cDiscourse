/**
 * UX-FEEDBACK-001 — MediatorProgressNote render + a11y + host wiring.
 *
 * The operator RE-LOCKED scope: STATIC current-state feedback ONLY (no
 * gamification, no transition language, no rating/score/like). This suite
 * proves the read-only display layer + the host mount points, by SOURCE-SCAN
 * for the heavily-pinned ArgumentGameSurface (the repo pattern for that file).
 *
 * Covers:
 *   - the note renders informational `<Text>`, NOT a Pressable (no tap-to-rate,
 *     no "Save feedback", no like/vote/score control, no onPress rating handler);
 *   - the EXACT static lines render; null note → null render;
 *   - tone → geometry (a left rule) so color is never the only signal (grayscale);
 *   - no banned token in any rendered string (rating/applause/transition/person);
 *   - the host mounts BOTH the default-visible selection cue and the Inspect note;
 *   - the host derives the notes from the ALREADY-derived board (no re-derivation);
 *   - NO new primary state chip (one-chip invariant holds);
 *   - NO topology / rail / timeline-geometry file change; no persistence; no submit;
 *   - impasse is NOT duplicated (the helper returns null there).
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render } from '@testing-library/react-native';

import { MediatorProgressNote } from '../src/features/mediator/MediatorProgressNote';
import {
  feedbackForMediatorProgress,
  _forbiddenFeedbackTokens,
} from '../src/features/mediator/feedbackForMediatorProgress';

const REPO = process.cwd();
const SURFACE_SRC = fs.readFileSync(
  path.join(REPO, 'src', 'features', 'arguments', 'room', 'ArgumentRoom.tsx'),
  'utf8',
);
const NOTE_SRC = fs.readFileSync(
  path.join(REPO, 'src', 'features', 'mediator', 'MediatorProgressNote.tsx'),
  'utf8',
);
const HELPER_SRC = fs.readFileSync(
  path.join(REPO, 'src', 'features', 'mediator', 'feedbackForMediatorProgress.ts'),
  'utf8',
);

/**
 * Strip block + line comments so prose-sensitive scans test CODE, not the
 * doctrine comments (which legitimately name the very tokens we forbid in code).
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
const NOTE_CODE = stripComments(NOTE_SRC);
const HELPER_CODE = stripComments(HELPER_SRC);

function collectText(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === 'object') return collectText((node as { children?: unknown }).children);
  return [];
}

function collectStyles(node: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (node == null || typeof node !== 'object') return out;
  const n = node as { props?: { style?: unknown }; children?: unknown };
  if (n.props?.style) {
    const styles = Array.isArray(n.props.style) ? n.props.style : [n.props.style];
    for (const s of styles) if (s && typeof s === 'object') out.push(s as Record<string, unknown>);
  }
  const children = (n as { children?: unknown }).children;
  if (Array.isArray(children)) children.forEach((c) => collectStyles(c, out));
  else if (children) collectStyles(children, out);
  return out;
}

// ── 1. Render: the exact static lines + null render ───────────

describe('UX-FEEDBACK-001 — MediatorProgressNote render', () => {
  it('renders null for a null note (the restraint default)', () => {
    expect(render(<MediatorProgressNote note={null} />).toJSON()).toBeNull();
  });

  it('renders "Claim narrowed." for a narrowed inspect note', () => {
    const note = feedbackForMediatorProgress('narrowed', { surface: 'inspect' });
    const { getByText } = render(<MediatorProgressNote note={note} />);
    expect(getByText('Claim narrowed.')).toBeTruthy();
  });

  it('renders "Concession preserved." for a preserved-concession note', () => {
    const note = feedbackForMediatorProgress('narrowed', {
      surface: 'inspect',
      isConcessionPreserved: true,
    });
    const { getByText } = render(<MediatorProgressNote note={note} />);
    expect(getByText('Concession preserved.')).toBeTruthy();
  });

  it('renders "Source path identified." for an identified-source-path note', () => {
    const note = feedbackForMediatorProgress('needs_evidence', {
      surface: 'inspect',
      hasIdentifiedSourcePath: true,
    });
    const { getByText } = render(<MediatorProgressNote note={note} />);
    expect(getByText('Source path identified.')).toBeTruthy();
  });

  it('renders "Point anchored." for an anchored selection cue', () => {
    const note = feedbackForMediatorProgress('open', { surface: 'selection', isNodeAnchored: true });
    const { getByText } = render(<MediatorProgressNote note={note} />);
    expect(getByText('Point anchored.')).toBeTruthy();
  });

  it('the line is informational Text (accessibilityRole="text")', () => {
    const note = feedbackForMediatorProgress('narrowed', { surface: 'inspect' });
    const { getByTestId } = render(<MediatorProgressNote note={note} testID="t" />);
    expect(getByTestId('t-line').props.accessibilityRole).toBe('text');
  });
});

// ── 2. NO tap-to-rate affordance (the central doctrine test) ──

describe('UX-FEEDBACK-001 — NO rating / like / vote / "Save feedback" affordance', () => {
  it('the note is NOT a Pressable and exposes no onPress', () => {
    const note = feedbackForMediatorProgress('narrowed', { surface: 'inspect' });
    const { getByTestId } = render(<MediatorProgressNote note={note} testID="t" />);
    const root = getByTestId('t');
    expect(root.props.accessibilityRole).not.toBe('button');
    expect(root.props.onPress).toBeUndefined();
  });

  it('the component source wires NO Pressable / onPress / rating / Save handler', () => {
    expect(NOTE_CODE).not.toMatch(/Pressable/);
    expect(NOTE_CODE).not.toMatch(/onPress/);
    expect(NOTE_CODE).not.toMatch(/onRate|onSave|onSubmit|Save feedback|saveFeedback/i);
  });

  it('the helper + component source wire NO rating/vote/score code identifier', () => {
    // Note: the helper's `_forbiddenFeedbackTokens` ban-list legitimately LISTS
    // plain words like "leaderboard" / "vote" as forbidden COPY tokens. This
    // scan targets rating-INFRASTRUCTURE identifiers (a real like/vote counter
    // or rating field), which never appear in either file.
    for (const src of [HELPER_CODE, NOTE_CODE]) {
      expect(src).not.toMatch(/like_count|likeCount|voteCount|upvoteCount|ratingValue|saveRating|recordVote|incrementScore/);
    }
  });

  it('the component imports nothing from the engine / pointStanding / argumentScoreModel', () => {
    const imports = (NOTE_SRC.match(/^import[\s\S]*?from\s+'[^']+';/gm) ?? []).join('\n');
    expect(imports).not.toMatch(/constitution\/engine/);
    expect(imports).not.toMatch(/pointStanding/);
    expect(imports).not.toMatch(/argumentScoreModel/);
  });
});

// ── 3. Tone → geometry (color is never the only signal) ───────

describe('UX-FEEDBACK-001 — tone carried by geometry, not color alone', () => {
  it('every tone renders a left-rule border (geometry) so grayscale stays legible', () => {
    for (const note of [
      feedbackForMediatorProgress('narrowed', { surface: 'inspect' }), // progress
      feedbackForMediatorProgress('needs_evidence', { surface: 'inspect', hasIdentifiedSourcePath: true }), // dignified
    ]) {
      const tree = render(<MediatorProgressNote note={note} />).toJSON();
      const styles = collectStyles(tree);
      const hasLeftRule = styles.some((s) => typeof s.borderLeftWidth === 'number' && (s.borderLeftWidth as number) > 0);
      expect(hasLeftRule).toBe(true);
    }
  });

  it('introduces no animation primitive (reduce-motion no-op)', () => {
    expect(NOTE_CODE).not.toMatch(/Animated|useNativeDriver|withTiming|confetti|LottieView/i);
  });

  it('uses no Image / badge / trophy asset', () => {
    expect(NOTE_CODE).not.toMatch(/<Image|require\(|badge|trophy/i);
  });
});

// ── 4. Ban-list clean rendered strings ────────────────────────

describe('UX-FEEDBACK-001 — rendered strings carry no banned token', () => {
  const BANNED = _forbiddenFeedbackTokens();
  it('no rendered string contains a banned token', () => {
    for (const note of [
      feedbackForMediatorProgress('narrowed', { surface: 'inspect' }),
      feedbackForMediatorProgress('narrowed', { surface: 'inspect', isConcessionPreserved: true }),
      feedbackForMediatorProgress('needs_evidence', { surface: 'inspect', hasIdentifiedSourcePath: true }),
      feedbackForMediatorProgress('needs_evidence', { surface: 'inspect' }),
      feedbackForMediatorProgress('open', { surface: 'selection', isNodeAnchored: true }),
    ]) {
      const tree = render(<MediatorProgressNote note={note} />).toJSON();
      for (const text of collectText(tree)) {
        const lower = text.toLowerCase();
        for (const token of BANNED) {
          expect(lower.includes(token)).toBe(false);
        }
      }
    }
  });
});

// ── 5. 390px + a11y (no overflow) ─────────────────────────────

describe('UX-FEEDBACK-001 — mobile width', () => {
  it.each([320, 360, 390, 414])('renders at width %ipx without throwing', (width) => {
    const prev = (global as { innerWidth?: number }).innerWidth;
    (global as { innerWidth?: number }).innerWidth = width;
    try {
      const note = feedbackForMediatorProgress('narrowed', { surface: 'inspect' });
      const { getByTestId } = render(<MediatorProgressNote note={note} testID="t" />);
      expect(getByTestId('t')).toBeTruthy();
    } finally {
      (global as { innerWidth?: number }).innerWidth = prev;
    }
  });
});

// ── 6. Host wiring (ArgumentGameSurface source-scan) ──────────

describe('UX-FEEDBACK-001 — ArgumentGameSurface host wiring', () => {
  it('imports the helper + the note component from the mediator feature', () => {
    expect(SURFACE_SRC).toMatch(
      /import \{ feedbackForMediatorProgress \} from '\.\.\/\.\.\/mediator\/feedbackForMediatorProgress'/,
    );
    expect(SURFACE_SRC).toMatch(
      /import \{ MediatorProgressNote \} from '\.\.\/\.\.\/mediator\/MediatorProgressNote'/,
    );
  });

  it('mounts the default-visible selection cue', () => {
    expect(SURFACE_SRC).toMatch(/testID="mediator-progress-note-selection"/);
    expect(SURFACE_SRC).toMatch(/note=\{activeNodeProgressSelectionNote\}/);
  });

  it('mounts the Inspect note in the existing "Move forward:" region', () => {
    expect(SURFACE_SRC).toMatch(/testID="mediator-progress-note-inspect"/);
    expect(SURFACE_SRC).toMatch(/note=\{activeNodeProgressInspectNote\}/);
  });

  it('derives both notes from the ALREADY-derived board (no re-derivation)', () => {
    // The notes read mediatorBoard / lifecycleMap / activeNodeMediatorMarker —
    // it never calls deriveRoomMediatorBoardState a second time for the notes.
    expect(SURFACE_SRC).toMatch(/feedbackForMediatorProgress\(displayState, \{/);
    const deriveCalls = (SURFACE_SRC.match(/deriveRoomMediatorBoardState\(/g) ?? []).length;
    expect(deriveCalls).toBe(1);
  });

  it('the selection cue uses the local node-selection event (isNodeAnchored), not persistence', () => {
    expect(SURFACE_SRC).toMatch(/isNodeAnchored/);
    expect(SURFACE_SRC).toMatch(/surface: 'selection'/);
  });

  it('the inspect note reads CURRENT-state context (concession + resolved source path)', () => {
    expect(SURFACE_SRC).toMatch(/isConcessionPreserved/);
    expect(SURFACE_SRC).toMatch(/hasIdentifiedSourcePath/);
    // resolved source path = a debt on the point that is not open and not blocked.
    expect(SURFACE_SRC).toMatch(/!d\.isOpen && !d\.isBlocked/);
  });
});

// ── 7. NO new primary chip / one-chip invariant preserved ─────

describe('UX-FEEDBACK-001 — no new primary state chip (one-chip invariant)', () => {
  it('the single active node marker chip mount is unchanged (exactly one)', () => {
    const chipMounts = (SURFACE_SRC.match(/testID="mediator-node-marker-active"/g) ?? []).length;
    expect(chipMounts).toBe(1);
  });

  it('the progress note source renders NO chip / badge component', () => {
    expect(NOTE_SRC).not.toMatch(/MediatorNodeMarker|AnnotationChip|NodeLabelStrip|MediatorNextMovesCard/);
  });
});

// ── 8. NO topology / rail / timeline-geometry change ──────────

describe('UX-FEEDBACK-001 — no board/rail/timeline topology change (display-only proof)', () => {
  it('the rails + timeline mounts are UNCHANGED (still present, not relocated)', () => {
    expect(SURFACE_SRC).toContain('<DisagreementPointsRail');
    expect(SURFACE_SRC).toContain('<ArgumentSideActionRail');
    expect(SURFACE_SRC).toContain('<OpenIssuesRail');
  });

  it('the note component introduces NO flex-row / column / two-pane layout', () => {
    expect(NOTE_SRC).not.toMatch(/flexDirection:\s*'row'/);
    expect(NOTE_SRC).not.toMatch(/leftRail|railColumn|boardColumn/);
  });

  it('the note component references no room-level rail / timeline component', () => {
    expect(NOTE_SRC).not.toMatch(/DisagreementPointsRail|ArgumentSideActionRail|OpenIssuesRail|ArgumentTimeline/);
  });

  it('the drawer mount gate (UX-SELECTED-NODE-001) is unchanged', () => {
    expect(SURFACE_SRC).toMatch(
      /inspectVisible && activeMessageId \?\s*\(\s*<SelectedNodeInspectDrawer/,
    );
  });
});

// ── 9. NO persistence / write / submit (display-only proof) ───

describe('UX-FEEDBACK-001 — no persistence / write / submit', () => {
  it('the helper + note wire no supabase / migration / write / submit', () => {
    for (const src of [HELPER_CODE, NOTE_CODE]) {
      expect(src).not.toMatch(/supabase|\.insert\(|\.update\(|submitArgument|submit-argument|createArgument/i);
    }
  });

  it('the note + helper reference no rating / event table', () => {
    for (const src of [HELPER_CODE, NOTE_CODE]) {
      expect(src).not.toMatch(/clarity_annotation|clarityAnnotation|feedback_event|feedbackEvent|rating_row|ratingRow/i);
    }
  });
});

// ── 10. Impasse NOT duplicated (cross-ref UX-IMPASSE-001) ──────

describe('UX-FEEDBACK-001 — impasse not duplicated', () => {
  it('the helper returns null for structured_impasse so no second impasse note renders', () => {
    expect(feedbackForMediatorProgress('structured_impasse', { surface: 'inspect' })).toBeNull();
    expect(
      feedbackForMediatorProgress('structured_impasse', { surface: 'selection', isNodeAnchored: true }),
    ).toBeNull();
  });

  it('the note source never re-renders the dignified impasse line', () => {
    expect(NOTE_CODE).not.toMatch(/The disagreement is preserved/);
    expect(HELPER_CODE).not.toMatch(/The disagreement is preserved/);
  });

  it('the sensitive composer-only marks never reach the note/helper', () => {
    const SENSITIVE = [
      'shifts_to_person_or_intent',
      'contains_unplayable_insult_only',
      'needs_pre_send_pause',
    ];
    for (const code of SENSITIVE) {
      expect(NOTE_SRC).not.toContain(code);
      expect(HELPER_SRC).not.toContain(code);
    }
  });
});
