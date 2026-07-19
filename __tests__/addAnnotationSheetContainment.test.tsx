/**
 * @jest-environment jsdom
 */
/**
 * A11Y-PR0-FOLLOW (issue 915) — AddAnnotationSheet containment (hook adoption).
 *
 * Proves the sheet now delegates its web Escape to the shared useOverlayA11y
 * hook (replacing the removed ad-hoc globalThis keydown effect) with parity:
 * a topmost Escape on web closes the sheet exactly once, and native is a no-op
 * (VoiceOver navigates via the rotor, not Tab/Escape). react-test-renderer
 * yields no DOM node for the container ref, so real Tab cycling is proven once
 * by the react-dom useOverlayA11y suite; here we assert the Escape wiring
 * (which is independent of the container).
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { AddAnnotationSheet } from '../src/features/evidence/AddAnnotationSheet';
import { __resetOverlayLayerStack } from '../src/features/a11y/overlayLayerStack';
import type { EvidenceAnnotationKind } from '../src/features/evidence/evidenceModel';

const KINDS: ReadonlyArray<EvidenceAnnotationKind> = ['primary_source'];

function dispatchEscape(): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  );
}

describe('A11Y-PR0-FOLLOW — AddAnnotationSheet web Escape (hook-owned)', () => {
  const originalOS = Platform.OS;
  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  });
  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });
  afterEach(() => {
    __resetOverlayLayerStack();
  });

  it('a topmost Escape closes the sheet exactly once', () => {
    const onClose = jest.fn();
    render(
      <AddAnnotationSheet
        visible
        eligibleKinds={KINDS}
        evidenceArtifactLabel="A source"
        onSubmit={jest.fn()}
        onClose={onClose}
      />,
    );
    dispatchEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('an Escape while the sheet is not visible does nothing (hook torn down)', () => {
    const onClose = jest.fn();
    render(
      <AddAnnotationSheet
        visible={false}
        eligibleKinds={KINDS}
        evidenceArtifactLabel="A source"
        onSubmit={jest.fn()}
        onClose={onClose}
      />,
    );
    dispatchEscape();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('A11Y-PR0-FOLLOW — AddAnnotationSheet native Escape no-op', () => {
  const originalOS = Platform.OS;
  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  });
  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });
  afterEach(() => {
    __resetOverlayLayerStack();
  });

  it('a document Escape does nothing on native (rotor navigation, not Tab/Escape)', () => {
    const onClose = jest.fn();
    render(
      <AddAnnotationSheet
        visible
        eligibleKinds={KINDS}
        evidenceArtifactLabel="A source"
        onSubmit={jest.fn()}
        onClose={onClose}
      />,
    );
    dispatchEscape();
    expect(onClose).not.toHaveBeenCalled();
  });
});
