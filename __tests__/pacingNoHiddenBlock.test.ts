/**
 * GAME-002 — the no-hidden-punishment proof.
 *
 * Doctrine: pacing is a consented, visible room rule — NOT a score and NOT
 * a validation gate. `canSendNow` is advisory chip-tone metadata only. This
 * file proves the model and component cannot become an invisible posting
 * block:
 *
 *   1. For the casual default, `evaluatePacing` ALWAYS returns
 *      `canSendNow: true / reason: 'ok' / nextAvailable: null` across an
 *      arbitrary matrix of recentMoves / now.
 *   2. `buildPacingChipViewModel` returns `visible: false` for the casual
 *      rule, so the chip renders nothing and adds no surface.
 *   3. The `PacingEvaluation` / `PacingChipViewModel` shapes expose NO
 *      "disable composer" / "block submit" field — the chip is status-only.
 *   4. `PacingChip` returns `null` when the view model is `visible:false`,
 *      verified by a source scan (the repo avoids the react-test-renderer
 *      harness; see argumentReplySidecar.test.tsx for the same convention).
 *   5. The dock wiring never disables the composer or the Post button.
 */
import fs from 'fs';
import path from 'path';
import {
  DEFAULT_CASUAL_PACING_RULE,
  createPacingRule,
  evaluatePacing,
  buildPacingChipViewModel,
  type PacingEvaluation,
  type PacingChipViewModel,
  type PacingMoveRecord,
} from '../src/features/modes/pacingModel';

const NOW = 1_700_000_000_000;

describe('casual default is a provable no-op', () => {
  // An arbitrary matrix of recentMoves counts and `now` offsets.
  const moveCounts = [0, 1, 3, 7, 25];
  const nowOffsets = [-10_000_000, 0, 5_000, 500_000, 200_000_000];

  for (const count of moveCounts) {
    for (const offset of nowOffsets) {
      it(`evaluatePacing returns ok for ${count} moves at now+${offset}`, () => {
        const recentMoves: PacingMoveRecord[] = Array.from(
          { length: count },
          (_unused, i) => ({ sentAtMs: NOW - i * 1000 }),
        );
        const result = evaluatePacing({
          rule: DEFAULT_CASUAL_PACING_RULE,
          recentMoves,
          now: NOW + offset,
        });
        expect(result.canSendNow).toBe(true);
        expect(result.reason).toBe('ok');
        expect(result.nextAvailable).toBeNull();
        expect(result.remainingToday).toBeNull();
      });
    }
  }

  it('buildPacingChipViewModel is visible:false for the casual rule', () => {
    for (const offset of nowOffsets) {
      const vm = buildPacingChipViewModel({
        rule: DEFAULT_CASUAL_PACING_RULE,
        recentMoves: [{ sentAtMs: NOW }],
        now: NOW + offset,
      });
      expect(vm.visible).toBe(false);
    }
  });
});

describe('the model exposes no posting-gate output', () => {
  it('PacingEvaluation has exactly the advisory fields — no block-submit flag', () => {
    const evaluation: PacingEvaluation = evaluatePacing({
      rule: createPacingRule({ maxMovesPerDay: 1 }),
      recentMoves: [{ sentAtMs: NOW }],
      now: NOW,
    });
    // The blocked state is still ONLY advisory metadata.
    expect(Object.keys(evaluation).sort()).toEqual(
      ['canSendNow', 'nextAvailable', 'reason', 'remainingToday'].sort(),
    );
    // No field named to disable / block / lock / gate posting.
    for (const key of Object.keys(evaluation)) {
      expect(key.toLowerCase()).not.toMatch(
        /disable|block|lock|gate|forbid|prevent/,
      );
    }
  });

  it('PacingChipViewModel has only render fields — no disable flag', () => {
    const vm: PacingChipViewModel = buildPacingChipViewModel({
      rule: createPacingRule({ cooldownAfterSendSec: 60 }),
      recentMoves: [{ sentAtMs: NOW }],
      now: NOW,
    });
    expect(Object.keys(vm).sort()).toEqual(
      [
        'accessibilityLabel',
        'canSendNow',
        'countdownLabel',
        'remainingLabel',
        'visible',
      ].sort(),
    );
    for (const key of Object.keys(vm)) {
      expect(key.toLowerCase()).not.toMatch(
        /disable|block|lock|gate|forbid|prevent/,
      );
    }
  });

  it('a fully blocked rule still only changes advisory fields', () => {
    // Daily cap hit + cooldown active — the hardest pacing state.
    const result = evaluatePacing({
      rule: createPacingRule({ maxMovesPerDay: 1, cooldownAfterSendSec: 600 }),
      recentMoves: [{ sentAtMs: NOW - 1000 }],
      now: NOW,
    });
    // canSendNow goes false — but that is the ONLY signal, and it is
    // advisory. There is no separate composer-disable output.
    expect(result.canSendNow).toBe(false);
    expect(typeof result.canSendNow).toBe('boolean');
  });
});

describe('PacingChip renders null when not visible (source scan)', () => {
  const componentSrc = fs.readFileSync(
    path.join(process.cwd(), 'src', 'features', 'modes', 'PacingChip.tsx'),
    'utf8',
  );

  it('returns null when the view model is not visible', () => {
    expect(componentSrc).toMatch(
      /viewModel\.visible !== true[\s\S]*return null/,
    );
  });

  it('is a non-interactive status display, not a Pressable', () => {
    expect(componentSrc).not.toMatch(/Pressable/);
    expect(componentSrc).toContain('accessibilityRole="text"');
  });

  it('carries no onPress / onAction callback prop', () => {
    expect(componentSrc).not.toMatch(/onPress/);
    expect(componentSrc).not.toMatch(/onAction/);
  });
});

describe('the dock never disables the composer because of pacing', () => {
  const dockSrc = fs.readFileSync(
    path.join(
      process.cwd(),
      'src',
      'features',
      'arguments',
      'ArgumentComposerDock.tsx',
    ),
    'utf8',
  );

  it('passes the chip a view model and does not gate ArgumentComposer on canSendNow', () => {
    // The composer mount must not be wrapped in a pacing condition.
    expect(dockSrc).toMatch(/<ArgumentComposer\b/);
    expect(dockSrc).not.toMatch(/canSendNow\s*&&\s*<ArgumentComposer/);
    expect(dockSrc).not.toMatch(/canSendNow\s*\?\s*<ArgumentComposer/);
  });

  it('does not pass a disabled / editable=false prop derived from pacing', () => {
    expect(dockSrc).not.toMatch(/disabled=\{[^}]*pacing/i);
    expect(dockSrc).not.toMatch(/editable=\{[^}]*pacing/i);
  });
});
