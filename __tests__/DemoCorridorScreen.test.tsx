/**
 * DEMO-001 — DemoCorridorScreen component tests.
 *
 * Mounts the REAL shipped components (ArgumentGameSurface → RefereeCardView /
 * OpenIssuesRail; the real OneBox via DemoComposerPanel) fed entirely from
 * the bundled fixture — proving the corridor is the real loop, not a parallel
 * UI. Asserts the production submit path is NEVER invoked (the pre-network
 * seam holds) and the corridor is completable / exitable.
 */
import React from 'react';
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// Spy on the network submit so we can prove it is never reached.
jest.mock('../src/lib/edgeFunctions', () => ({
  ...jest.requireActual('../src/lib/edgeFunctions'),
  submitArgumentDraft: jest.fn(),
}));
import { render, fireEvent, within } from '@testing-library/react-native';
import { AppSessionProvider } from '../src/features/session/AppSessionProvider';
import { DemoCorridorScreen } from '../src/features/demoCorridor/DemoCorridorScreen';
import { DemoCorridorGuidancePanel } from '../src/features/demoCorridor/DemoCorridorGuidancePanel';
import { CORRIDOR_COPY, CORRIDOR_STEPS } from '../src/features/demoCorridor/corridorModel';
import { submitArgumentDraft } from '../src/lib/edgeFunctions';

function mount(onExit: () => void = () => {}) {
  return render(
    <AppSessionProvider>
      <DemoCorridorScreen onExit={onExit} />
    </AppSessionProvider>,
  );
}

const advance = (r: ReturnType<typeof render>) => fireEvent.press(r.getByTestId('demo-corridor-primary'));

describe('DemoCorridorScreen — mounts the REAL room surface', () => {
  it('renders the real ArgumentGameSurface (RefereeCardView + OpenIssuesRail) from the fixture', () => {
    const r = mount();
    expect(r.getByTestId('demo-corridor-screen')).toBeTruthy();
    expect(r.getByTestId('demo-corridor-surface')).toBeTruthy();
    // VISUAL-SIMPLIFY-001 — the Referee Card now lives inside the active card's
    // ONE opt-in expansion; open it to reach the real shipped RefereeCardView.
    fireEvent.press(r.getByTestId('card-detail-more-toggle'));
    // The shipped components, by their own testIDs — not a demo re-skin.
    expect(r.queryByTestId('referee-card-view')).toBeTruthy();
    expect(r.queryByTestId('open-issues-rail')).toBeTruthy();
  });

  it('shows the stand-in framing on the first beat (open-question resolution)', () => {
    const r = mount();
    expect(r.getByTestId('demo-corridor-framing')).toBeTruthy();
    expect(r.getByText(CORRIDOR_COPY.standInFraming)).toBeTruthy();
  });

  it('renders exactly one primary affordance on the first beat with the step copy', () => {
    const r = mount();
    expect(r.getAllByTestId('demo-corridor-primary')).toHaveLength(1);
    expect(r.getByText(CORRIDOR_COPY.claimLines[0])).toBeTruthy();
  });
});

describe('DemoCorridorScreen — progression to the Referee Card beat', () => {
  it('walks to the referee beat where the real card reads "Source owed"', () => {
    const r = mount();
    // claim → disputed_point → referee_open_task
    advance(r);
    advance(r);
    expect(r.getByText(CORRIDOR_COPY.refereeOpenTaskLines[0])).toBeTruthy();
    // VISUAL-SIMPLIFY-001 — the full Referee Card is behind the active card's
    // ONE opt-in expansion; open it to read the derived zone-2 open task. The
    // collapsed default still surfaces the open task once via the single
    // advisory line (card-detail-advisory-line).
    expect(r.getByTestId('card-detail-advisory-line')).toBeTruthy();
    fireEvent.press(r.getByTestId('card-detail-more-toggle'));
    // The REAL Referee Card derived its open task from the fixture data.
    const zone2 = r.getByTestId('referee-card-zone2');
    expect(String(zone2.props.children)).toContain('Source owed');
  });
});

describe('DemoCorridorScreen — the four-move beat + the real composer', () => {
  function reachChooseMove() {
    const r = mount();
    advance(r); // → disputed_point
    advance(r); // → referee_open_task
    advance(r); // → choose_move
    return r;
  }

  it('renders the bounded four-move menu', () => {
    const r = reachChooseMove();
    const menu = r.getByTestId('demo-corridor-move-menu');
    expect(menu).toBeTruthy();
    for (const code of ['ask_source', 'add_evidence', 'narrow', 'branch']) {
      expect(within(menu).getByTestId(`demo-corridor-move-${code}`)).toBeTruthy();
    }
  });

  it('picking a move opens the DemoComposerPanel mounting the REAL OneBox', () => {
    const r = reachChooseMove();
    fireEvent.press(r.getByTestId('demo-corridor-move-narrow'));
    expect(r.getByTestId('demo-composer-panel')).toBeTruthy();
    // The actual shipped one-box, by its own testID.
    expect(r.queryByTestId('one-box')).toBeTruthy();
    expect(r.getByText(CORRIDOR_COPY.composerIntro)).toBeTruthy();
    // The move menu is replaced while composing.
    expect(r.queryByTestId('demo-corridor-move-menu')).toBeNull();
  });

  it('cancelling the composer returns to the move menu unchanged', () => {
    const r = reachChooseMove();
    fireEvent.press(r.getByTestId('demo-corridor-move-add_evidence'));
    expect(r.getByTestId('demo-composer-panel')).toBeTruthy();
    fireEvent.press(r.getByTestId('demo-composer-cancel'));
    expect(r.queryByTestId('demo-composer-panel')).toBeNull();
    expect(r.getByTestId('demo-corridor-move-menu')).toBeTruthy();
  });

  it('never invokes the production network submit across the whole flow', () => {
    const r = reachChooseMove();
    fireEvent.press(r.getByTestId('demo-corridor-move-ask_source'));
    expect(r.queryByTestId('one-box')).toBeTruthy();
    expect(submitArgumentDraft).not.toHaveBeenCalled();
  });
});

describe('DemoCorridorScreen — exit', () => {
  it('the persistent Close affordance calls onExit', () => {
    const onExit = jest.fn();
    const r = mount(onExit);
    fireEvent.press(r.getByTestId('demo-corridor-close'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('DemoCorridorScreen — the recruit-friendly closing screen', () => {
  // The closing screen IS the guidance panel rendered with the closing step +
  // headline (the screen's `view.isClosing` branch). Rendering it directly
  // pins the closing copy + the "Jump into a real room" exit primary without
  // the network-gated Post (covered end to end by the reducer model test).
  const closingStep = CORRIDOR_STEPS.find((s) => s.kind === 'closing')!;

  it('renders the closing headline + recruit line + the real-room primary', () => {
    const r = render(
      <DemoCorridorGuidancePanel
        step={closingStep}
        headline={CORRIDOR_COPY.closingHeadline}
        onPrimary={() => {}}
        onSecondary={() => {}}
      />,
    );
    expect(r.getByText(CORRIDOR_COPY.closingHeadline)).toBeTruthy();
    expect(r.getByText(CORRIDOR_COPY.closingRecruitLine)).toBeTruthy();
    expect(r.getByText(CORRIDOR_COPY.closingPrimary)).toBeTruthy();
    expect(r.getByText(CORRIDOR_COPY.replay)).toBeTruthy();
  });

  it('the closing primary action is an exit (drives onExit in the screen)', () => {
    const onPrimary = jest.fn();
    const r = render(
      <DemoCorridorGuidancePanel
        step={closingStep}
        headline={CORRIDOR_COPY.closingHeadline}
        onPrimary={onPrimary}
        onSecondary={() => {}}
      />,
    );
    fireEvent.press(r.getByTestId('demo-corridor-primary'));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onPrimary.mock.calls[0][0].kind).toBe('exit');
  });
});
