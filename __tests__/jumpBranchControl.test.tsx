/**
 * GAME-006 — JumpBranchControl component contract.
 *
 * The repo's test discipline avoids runtime react-test-renderer. The
 * confirm-required Jump control's load-bearing render decisions are exercised
 * through (a) the pure `JumpControlViewModel` that fully drives what it
 * renders and (b) a source-scan of the component for the accessibility +
 * confirm-step + safety contract.
 *
 * Asserts:
 *  - the action is a Pressable with role + label + hint + state.
 *  - tapping the action opens a confirm step — it does NOT jump; only the
 *    confirm button commits via onConfirmJump.
 *  - a disabled control still renders, with accessibilityState disabled and
 *    the plain-language reason as visible text (no silent no-op).
 *  - the confirm + cancel buttons are focusable Pressables in reading order.
 *  - a >=44px tap target via hitSlop; the disabled distinction is shape/text.
 *  - the component imports no router / navigation library; no service-role.
 */
import fs from 'fs';
import path from 'path';
import { JumpBranchControl } from '../src/features/debates/JumpBranchControl';
import {
  buildJumpControlViewModel,
  type JumpEligibility,
} from '../src/features/debates/jumpBranchModel';

const REPO = process.cwd();
const CONTROL_SRC = fs.readFileSync(
  path.join(REPO, 'src/features/debates/JumpBranchControl.tsx'),
  'utf8',
);

const CHIME_A = 'u-chime-a';

// ── The view-model the component renders ───────────────────────

describe('JumpBranchControl — render contract via the view-model', () => {
  it('an enabled view-model carries the confirm-step copy', () => {
    const ok: JumpEligibility = { ok: true, reason: null };
    const vm = buildJumpControlViewModel({
      eligibility: ok,
      participantUserId: CHIME_A,
      destinationBranchId: 'branch-b',
    });
    expect(vm.enabled).toBe(true);
    expect(vm.actionLabel.length).toBeGreaterThan(0);
    expect(vm.confirmPrompt.length).toBeGreaterThan(0);
    expect(vm.confirmLabel.length).toBeGreaterThan(0);
    expect(vm.cancelLabel.length).toBeGreaterThan(0);
    expect(vm.accessibilityLabel.length).toBeGreaterThan(0);
    expect(vm.accessibilityHint.length).toBeGreaterThan(0);
  });

  it('a disabled view-model carries a visible plain-language reason (no silent no-op)', () => {
    const denied: JumpEligibility = { ok: false, reason: 'jump_already_used' };
    const vm = buildJumpControlViewModel({
      eligibility: denied,
      participantUserId: CHIME_A,
      destinationBranchId: 'branch-b',
    });
    expect(vm.enabled).toBe(false);
    expect(vm.disabledReasonLabel).not.toBeNull();
    expect((vm.disabledReasonLabel as string).length).toBeGreaterThan(0);
  });
});

// ── Source-scan — accessibility + confirm-step + safety ────────

describe('JumpBranchControl — source contract', () => {
  it('is exported as a named function component', () => {
    expect(typeof JumpBranchControl).toBe('function');
  });

  it('uses only View / Text / Pressable RN primitives (no new dependency)', () => {
    expect(CONTROL_SRC).toContain("from 'react-native'");
    expect(CONTROL_SRC).toContain('Pressable');
  });

  it('the action Pressable carries role, label, hint, and state', () => {
    expect(CONTROL_SRC).toContain('accessibilityRole="button"');
    expect(CONTROL_SRC).toContain('accessibilityLabel={viewModel.accessibilityLabel}');
    expect(CONTROL_SRC).toContain('accessibilityHint={viewModel.accessibilityHint}');
    expect(CONTROL_SRC).toContain('accessibilityState=');
    expect(CONTROL_SRC).toContain('disabled: !viewModel.enabled');
  });

  it('tapping the action opens a confirm step — it does not jump directly', () => {
    // handleActionPress sets confirmOpen; it never calls onConfirmJump.
    expect(CONTROL_SRC).toContain('const handleActionPress');
    expect(CONTROL_SRC).toContain('setConfirmOpen(true)');
    // onConfirmJump is fired only from handleConfirm.
    expect(CONTROL_SRC).toContain('const handleConfirm');
    expect(CONTROL_SRC).toContain('onConfirmJump(viewModel.destinationBranchId)');
    // The action onPress is handleActionPress, not onConfirmJump.
    expect(CONTROL_SRC).toContain('onPress={handleActionPress}');
  });

  it('only the confirm button commits the jump; cancel dismisses without commit', () => {
    expect(CONTROL_SRC).toContain('onPress={handleConfirm}');
    expect(CONTROL_SRC).toContain('onPress={handleCancel}');
    // handleCancel must not commit — it only closes + calls onCancel.
    const cancelBlock = CONTROL_SRC.slice(
      CONTROL_SRC.indexOf('const handleCancel'),
      CONTROL_SRC.indexOf('const handleCancel') + 160,
    );
    expect(cancelBlock).not.toContain('onConfirmJump');
  });

  it('a disabled action renders with the disabled reason as visible text', () => {
    expect(CONTROL_SRC).toContain('jump-branch-disabled-reason');
    expect(CONTROL_SRC).toContain('viewModel.disabledReasonLabel');
    // The reason is rendered inside a <Text>, not just an a11y attribute.
    expect(CONTROL_SRC).toContain('{viewModel.disabledReasonLabel}');
  });

  it('the confirm + cancel buttons are focusable Pressables in reading order', () => {
    expect(CONTROL_SRC).toContain('jump-branch-confirm-button');
    expect(CONTROL_SRC).toContain('jump-branch-cancel-button');
    // The confirm button appears before the cancel button in source order.
    expect(CONTROL_SRC.indexOf('jump-branch-confirm-button')).toBeLessThan(
      CONTROL_SRC.indexOf('jump-branch-cancel-button'),
    );
  });

  it('every Pressable carries a hitSlop for the >=44px tap target', () => {
    expect(CONTROL_SRC).toContain('JUMP_HIT_SLOP');
    expect(CONTROL_SRC).toContain('hitSlop={JUMP_HIT_SLOP}');
  });

  it('the disabled distinction is shape/text, not color alone', () => {
    // A disabled action gets a dashed border — a shape signal that reads in
    // grayscale.
    expect(CONTROL_SRC).toContain('actionButtonDisabled');
    expect(CONTROL_SRC).toContain("borderStyle: 'dashed'");
  });

  it('imports no router / navigation library (no route transition)', () => {
    expect(CONTROL_SRC).not.toContain('navigation');
    expect(CONTROL_SRC).not.toContain('expo-router');
    expect(CONTROL_SRC).not.toContain('@react-navigation');
  });

  it('has no service-role / functions.invoke / network call', () => {
    expect(CONTROL_SRC).not.toContain('SERVICE_ROLE');
    expect(CONTROL_SRC).not.toContain('functions.invoke');
    expect(CONTROL_SRC).not.toContain('fetch(');
  });

  it('leaves no console.log in committed code', () => {
    expect(CONTROL_SRC).not.toContain('console.log');
  });
});
