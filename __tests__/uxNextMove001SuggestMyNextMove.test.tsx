/**
 * UX-NEXT-MOVE-001 — "What would move this forward?" selected-node guidance
 * (LOCAL, display-only).
 *
 * Covers:
 *   - the pure `nextMovesForState` nine-state map (the §3 operator-locked map):
 *     dominant-first ordering, exactly one dominant, the correct alternates,
 *     determinism, and the insufficient/unknown → neutral Open fallback;
 *   - the four superset display-state collapses (handled by `v4DisplayStateFor`);
 *   - copy ban-list cleanliness (no verdict / person / popularity / intent
 *     token; no snake_case leak) + the exact title;
 *   - the `MediatorNextMovesCard` render: title (header), the alternates, the
 *     dominant emphasis, actionable rows touch-safe (role=button + 44px), and
 *     unavailable rows as non-pressable guidance;
 *   - guidance-only (no submit/action wired): onSelectMove optional, undefined →
 *     guidance labels, supplied → routes the stepCode to the host's existing
 *     handler only (no new action semantics);
 *   - shared-source proof (the dominant stepCode equals the first available
 *     pathway step for that state — the same source Act reads);
 *   - host wiring (source-scan): the card fills the existing drawer "Move
 *     forward:" slot and touches NO timeline / rail / board-column file.
 *
 * The large, heavily-pinned ArgumentGameSurface mount tree is verified by
 * SOURCE-SCAN (the repo pattern for that file).
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import {
  nextMovesForState,
  _forbiddenNextMoveTokens,
  type NextMove,
} from '../src/features/mediator/nextMovesForState';
import { MediatorNextMovesCard } from '../src/features/mediator/MediatorNextMovesCard';
import {
  ALL_V4_MEDIATOR_STATE_CODES,
  V4_DISPLAY_STATE_BY_CODE,
} from '../src/features/mediator/mediatorBoardTypes';
import { v4DisplayStateFor } from '../src/features/mediator/deriveMediatorBoardState';
import type {
  V4MediatorStateCode,
  ResolutionPathwayStepCode,
} from '../src/features/mediator/mediatorBoardTypes';
import { TOUCH_TARGET } from '../src/lib/designTokens';

/**
 * A hitSlop satisfies the 44px touch target when, combined with a row min
 * height of `TOUCH_TARGET.minSizePx`, it has non-zero slop on all four sides
 * (the row already meets the height via `minHeight`; the slop widens the
 * pressable). We assert the slop is the canonical `hitSlopAll` shape.
 */
function TOUCH_TARGET_OK(hitSlop: unknown): boolean {
  if (!hitSlop || typeof hitSlop !== 'object') return false;
  const h = hitSlop as { top?: number; bottom?: number; left?: number; right?: number };
  return (
    (h.top ?? 0) > 0 && (h.bottom ?? 0) > 0 && (h.left ?? 0) > 0 && (h.right ?? 0) > 0
  );
}

const REPO = process.cwd();
const SURFACE_SRC = fs.readFileSync(
  path.join(REPO, 'src', 'features', 'arguments', 'ArgumentGameSurface.tsx'),
  'utf8',
);
const CARD_SRC = fs.readFileSync(
  path.join(REPO, 'src', 'features', 'mediator', 'MediatorNextMovesCard.tsx'),
  'utf8',
);
const HELPER_SRC = fs.readFileSync(
  path.join(REPO, 'src', 'features', 'mediator', 'nextMovesForState.ts'),
  'utf8',
);

// The exact dominant label per state (the §3 operator-locked map). The first
// move of each state's list. Used to pin the dominant-first ordering.
const EXPECTED_DOMINANT: Readonly<Record<V4MediatorStateCode, string>> = {
  needs_evidence: 'Ask for a source',
  evidence_blocked: 'Mark evidence unavailable',
  definition_not_shared: 'Define the key term',
  scope_mismatch: 'Narrow the claim',
  missing_mechanism: 'Add the missing link',
  narrowed: 'Continue on the smaller point',
  accounts_differ: 'Separate memory from records',
  structured_impasse: 'Preserve the disagreement',
  open: 'Respond to the exact point',
};

// The full ordered alternate label list (the entries AFTER the dominant), per
// state. Empty when the state has only the dominant move.
const EXPECTED_ALTERNATES: Readonly<Record<V4MediatorStateCode, ReadonlyArray<string>>> = {
  needs_evidence: ['Add evidence'],
  evidence_blocked: ['Branch the provable part', 'Name what kind of record would test this point'],
  definition_not_shared: [],
  scope_mismatch: ['Branch the provable part', 'Respond to the exact point', 'Accept the narrower scope'],
  missing_mechanism: ['Ask for the mechanism'],
  narrowed: ['Concede the resolved part'],
  accounts_differ: ['Name what could verify it'],
  structured_impasse: ['Reopen with a source, definition, or narrower claim'],
  open: ['Ask a clarifying question'],
};

function labels(moves: ReadonlyArray<NextMove>): string[] {
  return moves.map((m) => m.label);
}

function collectText(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === 'object') return collectText((node as { children?: unknown }).children);
  return [];
}

// ── 1. State → move map coverage (acceptance core) ────────────

describe('UX-NEXT-MOVE-001 — nextMovesForState §3 map (nine states)', () => {
  it('returns the correct dominant move first for every display state', () => {
    for (const state of ALL_V4_MEDIATOR_STATE_CODES) {
      const moves = nextMovesForState(state);
      expect(moves.length).toBeGreaterThan(0);
      expect(moves[0].label).toBe(EXPECTED_DOMINANT[state]);
      expect(moves[0].isDominant).toBe(true);
    }
  });

  it('returns the correct ordered alternates for every display state', () => {
    for (const state of ALL_V4_MEDIATOR_STATE_CODES) {
      const moves = nextMovesForState(state);
      expect(labels(moves).slice(1)).toEqual(EXPECTED_ALTERNATES[state]);
    }
  });

  it('every non-empty list has EXACTLY one dominant move, at index 0', () => {
    for (const state of ALL_V4_MEDIATOR_STATE_CODES) {
      const moves = nextMovesForState(state);
      const dominants = moves.filter((m) => m.isDominant);
      expect(dominants).toHaveLength(1);
      expect(moves[0].isDominant).toBe(true);
      expect(moves.slice(1).every((m) => !m.isDominant)).toBe(true);
    }
  });

  it('produces stable unique ids per move', () => {
    for (const state of ALL_V4_MEDIATOR_STATE_CODES) {
      const moves = nextMovesForState(state);
      const ids = new Set(moves.map((m) => m.id));
      expect(ids.size).toBe(moves.length);
    }
  });
});

// ── 2. Determinism ────────────────────────────────────────────

describe('UX-NEXT-MOVE-001 — determinism', () => {
  it('same input deep-equals same output for every state', () => {
    for (const state of ALL_V4_MEDIATOR_STATE_CODES) {
      expect(nextMovesForState(state)).toEqual(nextMovesForState(state));
    }
  });

  it('introduces no clock / randomness in the helper source', () => {
    expect(HELPER_SRC).not.toMatch(/Date\.now|new Date|Math\.random|performance\.now/);
  });
});

// ── 3. The four superset codes collapse via v4DisplayStateFor ──

describe('UX-NEXT-MOVE-001 — superset display-state collapses (drift guard)', () => {
  it('value_tradeoff → open (shows the Open move set)', () => {
    expect(v4DisplayStateFor('value_tradeoff')).toBe('open');
    expect(V4_DISPLAY_STATE_BY_CODE.value_tradeoff).toBe('open');
    const moves = nextMovesForState(v4DisplayStateFor('value_tradeoff') as V4MediatorStateCode);
    expect(moves[0].label).toBe('Respond to the exact point');
  });

  it('key_detail_unavailable → evidence_blocked (shows the evidence-blocked set)', () => {
    expect(v4DisplayStateFor('key_detail_unavailable')).toBe('evidence_blocked');
    const moves = nextMovesForState(v4DisplayStateFor('key_detail_unavailable') as V4MediatorStateCode);
    expect(moves[0].label).toBe('Mark evidence unavailable');
  });

  it('off_point → scope_mismatch (shows the scope set)', () => {
    expect(v4DisplayStateFor('off_point')).toBe('scope_mismatch');
    const moves = nextMovesForState(v4DisplayStateFor('off_point') as V4MediatorStateCode);
    expect(moves[0].label).toBe('Narrow the claim');
  });
});

// ── 4. Insufficient / unknown → neutral Open fallback ─────────

describe('UX-NEXT-MOVE-001 — insufficient signal → Open fallback', () => {
  it('an unknown state collapses to the Open set (never an accusation)', () => {
    // The helper is typed over the nine; an out-of-band value falls to Open.
    const moves = nextMovesForState('not_a_real_state' as unknown as V4MediatorStateCode);
    expect(moves[0].label).toBe('Respond to the exact point');
    expect(labels(moves)).toEqual(['Respond to the exact point', 'Ask a clarifying question']);
  });

  it('the Open dominant is the neutral "Respond to the exact point"', () => {
    expect(nextMovesForState('open')[0].label).toBe('Respond to the exact point');
  });
});

// ── 5. Copy ban-list (doctrine §1/§2/§3/§4/§9) ────────────────

describe('UX-NEXT-MOVE-001 — ban-list clean copy', () => {
  const BANNED = _forbiddenNextMoveTokens();

  it('no label or rationale contains a banned token, across all nine states', () => {
    for (const state of ALL_V4_MEDIATOR_STATE_CODES) {
      for (const move of nextMovesForState(state)) {
        const lower = `${move.label} ${move.rationale}`.toLowerCase();
        for (const token of BANNED) {
          expect(lower.includes(token)).toBe(false);
        }
      }
    }
  });

  it('no label or rationale leaks snake_case', () => {
    for (const state of ALL_V4_MEDIATOR_STATE_CODES) {
      for (const move of nextMovesForState(state)) {
        expect(move.label).not.toMatch(/[a-z]+_[a-z]+/);
        expect(move.rationale).not.toMatch(/[a-z]+_[a-z]+/);
      }
    }
  });

  it('explicitly excludes the §4 ban tokens from all copy', () => {
    const EXPLICIT = [
      'decide for me',
      'ai thinks',
      'truth',
      'verdict',
      'winner',
      'loser',
      'score',
      'fallacy',
      'dishonest',
      'bad faith',
      'manipulative',
      'credibility',
      'intent',
      'emotion',
      'tone',
      'anger',
    ];
    const all: string[] = [];
    for (const state of ALL_V4_MEDIATOR_STATE_CODES) {
      for (const move of nextMovesForState(state)) {
        all.push(move.label.toLowerCase(), move.rationale.toLowerCase());
      }
    }
    for (const s of all) {
      for (const token of EXPLICIT) {
        expect(s.includes(token)).toBe(false);
      }
    }
  });

  it('the card title is exactly "What would move this forward?"', () => {
    const { getByTestId } = render(
      <MediatorNextMovesCard moves={nextMovesForState('open')} />,
    );
    expect(getByTestId('mediator-next-moves-card-title').props.children).toBe(
      'What would move this forward?',
    );
  });

  it('the rendered card carries no banned token (lead + labels + rationales)', () => {
    for (const state of ALL_V4_MEDIATOR_STATE_CODES) {
      const tree = render(
        <MediatorNextMovesCard moves={nextMovesForState(state)} />,
      ).toJSON();
      for (const text of collectText(tree)) {
        const lower = text.toLowerCase();
        for (const token of BANNED) {
          expect(lower.includes(token)).toBe(false);
        }
      }
    }
  });

  it('the lead is structural and names no conclusion token', () => {
    const { getByTestId } = render(
      <MediatorNextMovesCard moves={nextMovesForState('open')} />,
    );
    const lead = getByTestId('mediator-next-moves-card-lead').props.children as string;
    expect(typeof lead).toBe('string');
    for (const token of BANNED) {
      expect(lead.toLowerCase().includes(token)).toBe(false);
    }
  });
});

// ── 6. No chip soup / no conclusion ───────────────────────────

describe('UX-NEXT-MOVE-001 — no chip soup / no who-is-right string', () => {
  it('renders moves (actions), not a second state chip or a who-is-right line', () => {
    const tree = render(
      <MediatorNextMovesCard moves={nextMovesForState('scope_mismatch')} />,
    ).toJSON();
    const joined = collectText(tree).join(' ').toLowerCase();
    expect(joined).not.toMatch(/who is right|is correct|you won|you lost/);
    // It renders the move labels, not the mediator state code label itself as a
    // competing chip.
    expect(joined).not.toMatch(/scope mismatch/);
  });

  it('the card source imports no chip/badge component (it renders rows, not chips)', () => {
    expect(CARD_SRC).not.toMatch(/AnnotationChip|MediatorNodeMarker|NodeLabelStrip/);
  });
});

// ── 7. Render: dominant emphasis + unavailable-as-guidance ────

describe('UX-NEXT-MOVE-001 — MediatorNextMovesCard render', () => {
  it('renders null for an empty move list', () => {
    expect(render(<MediatorNextMovesCard moves={[]} />).toJSON()).toBeNull();
  });

  it('renders the dominant + all alternates for a multi-move state', () => {
    const moves = nextMovesForState('scope_mismatch');
    const { getByText } = render(<MediatorNextMovesCard moves={moves} />);
    for (const move of moves) {
      expect(getByText(move.label)).toBeTruthy();
    }
  });

  it('the title exposes accessibilityRole="header"', () => {
    const { getByTestId } = render(
      <MediatorNextMovesCard moves={nextMovesForState('needs_evidence')} />,
    );
    expect(getByTestId('mediator-next-moves-card-title').props.accessibilityRole).toBe('header');
  });

  it('with onSelectMove supplied, an actionable row is a touch-safe button', () => {
    const moves = nextMovesForState('needs_evidence'); // dominant is available
    const onSelectMove = jest.fn();
    const { getByTestId } = render(
      <MediatorNextMovesCard moves={moves} onSelectMove={onSelectMove} />,
    );
    const row = getByTestId(`mediator-next-moves-card-move-${moves[0].id}`);
    expect(row.props.accessibilityRole).toBe('button');
    expect(typeof row.props.accessibilityLabel).toBe('string');
    expect(row.props.hitSlop).toEqual(TOUCH_TARGET.hitSlopAll);
    expect(TOUCH_TARGET_OK(row.props.hitSlop)).toBe(true);
  });

  it('an unavailable row is a non-pressable guidance block even with onSelectMove', () => {
    const moves = nextMovesForState('structured_impasse'); // all available:false
    const onSelectMove = jest.fn();
    const { getByTestId } = render(
      <MediatorNextMovesCard moves={moves} onSelectMove={onSelectMove} />,
    );
    for (const move of moves) {
      const row = getByTestId(`mediator-next-moves-card-move-${move.id}`);
      // Non-pressable: no button role.
      expect(row.props.accessibilityRole).not.toBe('button');
    }
  });
});

// ── 8. Guidance-only: onSelectMove wiring (no new action) ──────

describe('UX-NEXT-MOVE-001 — guidance-only (no submit / action wired)', () => {
  it('with onSelectMove supplied, pressing an actionable row calls it with the stepCode', () => {
    const moves = nextMovesForState('definition_not_shared');
    const onSelectMove = jest.fn<void, [ResolutionPathwayStepCode]>();
    const { getByTestId } = render(
      <MediatorNextMovesCard moves={moves} onSelectMove={onSelectMove} />,
    );
    fireEvent.press(getByTestId(`mediator-next-moves-card-move-${moves[0].id}`));
    expect(onSelectMove).toHaveBeenCalledTimes(1);
    expect(onSelectMove).toHaveBeenCalledWith(moves[0].stepCode);
  });

  it('with onSelectMove undefined, rows render as guidance and pressing throws nothing', () => {
    const moves = nextMovesForState('needs_evidence');
    const { getByTestId } = render(<MediatorNextMovesCard moves={moves} />);
    const row = getByTestId(`mediator-next-moves-card-move-${moves[0].id}`);
    // Guidance-only default: not a button.
    expect(row.props.accessibilityRole).not.toBe('button');
    expect(() => fireEvent.press(row)).not.toThrow();
  });

  it('the card source wires no submit / post / new-action call', () => {
    expect(CARD_SRC).not.toMatch(/submitArgument|submit-argument|onSubmit|onPost|createArgument/);
  });
});

// ── 9. Shared-source proof (the Act target reads one source) ──

describe('UX-NEXT-MOVE-001 — dominant stepCode shares the pathway source', () => {
  // The dominant move's stepCode for each state equals the first AVAILABLE
  // pathway step code pathwayForState/board.pathwaysByPointId produces — the
  // same source Act routes to. Re-encoded here from the shipped switch.
  const FIRST_AVAILABLE_STEP: Readonly<Record<V4MediatorStateCode, ResolutionPathwayStepCode>> = {
    needs_evidence: 'provide_source',
    evidence_blocked: 'narrow_or_branch', // await_record is unavailable; first AVAILABLE is narrow_or_branch
    definition_not_shared: 'define_term',
    scope_mismatch: 'narrow_or_branch',
    missing_mechanism: 'supply_mechanism',
    narrowed: 'respond_to_point',
    accounts_differ: 'await_record', // none available; the await step is the only one
    structured_impasse: 'await_record',
    open: 'respond_to_point',
  };

  it('the dominant (or first available) stepCode matches the pathway first-available step', () => {
    for (const state of ALL_V4_MEDIATOR_STATE_CODES) {
      const moves = nextMovesForState(state);
      const firstAvailable = moves.find((m) => m.available) ?? moves[0];
      expect(firstAvailable.stepCode).toBe(FIRST_AVAILABLE_STEP[state]);
    }
  });
});

// ── 10. 390px + a11y (no overflow, touch-safe) ────────────────

describe('UX-NEXT-MOVE-001 — mobile + a11y', () => {
  it.each([320, 360, 390, 414])(
    'renders the card at width %ipx without throwing',
    (width) => {
      const prev = (global as { innerWidth?: number }).innerWidth;
      (global as { innerWidth?: number }).innerWidth = width;
      try {
        const moves = nextMovesForState('scope_mismatch');
        const { getByTestId } = render(
          <MediatorNextMovesCard moves={moves} onSelectMove={jest.fn()} />,
        );
        expect(getByTestId('mediator-next-moves-card')).toBeTruthy();
      } finally {
        (global as { innerWidth?: number }).innerWidth = prev;
      }
    },
  );

  it('every actionable interactive row meets the 44px hit target via hitSlop', () => {
    const moves = nextMovesForState('scope_mismatch');
    const { getByTestId } = render(
      <MediatorNextMovesCard moves={moves} onSelectMove={jest.fn()} />,
    );
    for (const move of moves.filter((m) => m.available)) {
      const row = getByTestId(`mediator-next-moves-card-move-${move.id}`);
      expect(row.props.accessibilityRole).toBe('button');
      expect(TOUCH_TARGET_OK(row.props.hitSlop)).toBe(true);
    }
  });
});

// ── 11. Host wiring (ArgumentGameSurface source-scan) ─────────

describe('UX-NEXT-MOVE-001 — ArgumentGameSurface drawer-slot wiring', () => {
  it('imports the card + helper from the mediator feature', () => {
    expect(SURFACE_SRC).toMatch(
      /import \{ MediatorNextMovesCard \} from '\.\.\/mediator\/MediatorNextMovesCard'/,
    );
    expect(SURFACE_SRC).toMatch(
      /import \{ nextMovesForState \} from '\.\.\/mediator\/nextMovesForState'/,
    );
  });

  it('fills the existing "Move forward:" slot with MediatorNextMovesCard', () => {
    expect(SURFACE_SRC).toMatch(/moveForward=\{[\s\S]*?<MediatorNextMovesCard/);
  });

  it('feeds the card from the marker display state via v4DisplayStateFor + nextMovesForState', () => {
    expect(SURFACE_SRC).toMatch(/v4DisplayStateFor\(activeNodeMediatorMarker\.code\)/);
    expect(SURFACE_SRC).toMatch(/nextMovesForState\(displayState\)/);
  });

  it('self-suppresses the slot when the move set is empty (no dangling header)', () => {
    expect(SURFACE_SRC).toMatch(/activeNodeNextMoves\.length > 0 \?\s*\(\s*<MediatorNextMovesCard/);
  });

  it('ships guidance-only — the host passes NO onSelectMove (no new action semantics)', () => {
    const slice = SURFACE_SRC.slice(
      SURFACE_SRC.indexOf('<MediatorNextMovesCard'),
      SURFACE_SRC.indexOf('<MediatorNextMovesCard') + 220,
    );
    expect(slice).not.toMatch(/onSelectMove=/);
  });
});

// ── 12. NO topology / rail / timeline-geometry change (PROOF) ──

describe('UX-NEXT-MOVE-001 — no board/rail/timeline topology change (display-only proof)', () => {
  it('the rails + timeline mounts are UNCHANGED (still present, not relocated)', () => {
    expect(SURFACE_SRC).toContain('<DisagreementPointsRail');
    expect(SURFACE_SRC).toContain('<ArgumentSideActionRail');
    expect(SURFACE_SRC).toContain('<OpenIssuesRail');
  });

  it('the Act-dominant dock + single primary chip (UX-SELECTED-NODE-001) are preserved', () => {
    const dominantCount = (SURFACE_SRC.match(/menuTriggerButtonDominant/g) ?? []).length;
    expect(dominantCount).toBe(2); // one JSX usage (Act) + one StyleSheet def
    const chipMounts = (SURFACE_SRC.match(/testID="mediator-node-marker-active"/g) ?? []).length;
    expect(chipMounts).toBe(1);
  });

  it('the card introduces NO flex-row / column / two-pane layout', () => {
    expect(CARD_SRC).not.toMatch(/flexDirection:\s*'row'/);
    expect(CARD_SRC).not.toMatch(/leftRail|railColumn|boardColumn/);
  });

  it('the card references no room-level rail / timeline component', () => {
    expect(CARD_SRC).not.toMatch(/DisagreementPointsRail|ArgumentSideActionRail|OpenIssuesRail|ArgumentTimeline/);
  });

  it('the drawer mount gate (UX-SELECTED-NODE-001) is unchanged', () => {
    expect(SURFACE_SRC).toMatch(
      /inspectVisible && activeMessageId \?\s*\(\s*<SelectedNodeInspectDrawer/,
    );
  });
});

// ── 13. Sensitive composer-only marks never reach the card ────

describe('UX-NEXT-MOVE-001 — sensitive composer-only marks stay hidden', () => {
  it('the card source never references a sensitive composer-only code', () => {
    const SENSITIVE = [
      'shifts_to_person_or_intent',
      'contains_unplayable_insult_only',
      'needs_pre_send_pause',
    ];
    for (const code of SENSITIVE) {
      expect(CARD_SRC).not.toContain(code);
      expect(HELPER_SRC).not.toContain(code);
    }
  });
});
