/**
 * UX-COMPOSER-005 (#831) — callback capture model. Real-derivation over the
 * production helpers. INV-1 (weaver-capture gate) is a firing control: an empty
 * / self-room capture can never be usable.
 */
import {
  clampCallbackExcerpt,
  isCaptureUsable,
  captureToCallback,
  deriveCallbackEchoPreview,
  type CallbackCaptureResult,
} from '../src/features/arguments/crossRoom/callbackCaptureModel';
import { MAX_CALLBACK_EXCERPT_CHARS } from '../src/features/arguments/crossRoom/crossRoomCallbackRef';
import { CALLBACK_GLYPH } from '../src/features/arguments/crossRoom/callbackComposerCopy';

function makeCapture(overrides: Partial<CallbackCaptureResult> = {}): CallbackCaptureResult {
  return {
    targetDebateId: 'debate-prior-1',
    targetTitleSnapshot: 'Bike-lane baseline',
    excerpt: 'Protected lanes reduce collisions on arterials.',
    capturedFromArgumentId: 'arg-9',
    ...overrides,
  };
}

describe('clampCallbackExcerpt', () => {
  it('trims surrounding whitespace', () => {
    expect(clampCallbackExcerpt('   hello   ')).toBe('hello');
  });

  it('caps at the persisted ceiling', () => {
    const out = clampCallbackExcerpt('a'.repeat(MAX_CALLBACK_EXCERPT_CHARS + 25));
    expect(out.length).toBe(MAX_CALLBACK_EXCERPT_CHARS);
  });

  it('tolerates a nullish input without throwing', () => {
    expect(clampCallbackExcerpt(undefined as unknown as string)).toBe('');
  });
});

describe('isCaptureUsable', () => {
  it('is true for a valid non-self capture', () => {
    expect(isCaptureUsable(makeCapture(), 'current-room')).toBe(true);
  });

  it('is false for null / undefined', () => {
    expect(isCaptureUsable(null)).toBe(false);
    expect(isCaptureUsable(undefined)).toBe(false);
  });

  it('is false for an empty / whitespace excerpt (INV-1 firing control)', () => {
    expect(isCaptureUsable(makeCapture({ excerpt: '' }))).toBe(false);
    expect(isCaptureUsable(makeCapture({ excerpt: '    ' }))).toBe(false);
  });

  it('is false for an empty target debate id', () => {
    expect(isCaptureUsable(makeCapture({ targetDebateId: '' }))).toBe(false);
    expect(isCaptureUsable(makeCapture({ targetDebateId: '   ' }))).toBe(false);
  });

  it('is false when the capture is a self-reference to the current room', () => {
    expect(isCaptureUsable(makeCapture({ targetDebateId: 'room-x' }), 'room-x')).toBe(false);
  });

  it('is usable when no currentDebateId is supplied (self-check skipped)', () => {
    expect(isCaptureUsable(makeCapture())).toBe(true);
  });
});

describe('captureToCallback', () => {
  it('maps a capture into a draft callback with a clamped excerpt', () => {
    const cb = captureToCallback(makeCapture({ excerpt: '   trimmed   ' }));
    expect(cb).toEqual({
      targetDebateId: 'debate-prior-1',
      targetTitleSnapshot: 'Bike-lane baseline',
      excerpt: 'trimmed',
      capturedFromArgumentId: 'arg-9',
    });
  });

  it('defaults a missing capturedFromArgumentId to null', () => {
    const cb = captureToCallback(makeCapture({ capturedFromArgumentId: null }));
    expect(cb.capturedFromArgumentId).toBeNull();
  });
});

describe('deriveCallbackEchoPreview', () => {
  it('produces the glyph, header, quoted line, origin, and remove a11y', () => {
    const preview = deriveCallbackEchoPreview(captureToCallback(makeCapture()));
    expect(preview.glyph).toBe(CALLBACK_GLYPH);
    expect(preview.header).toBe('Woven callback');
    expect(preview.quotedLine).toBe('Protected lanes reduce collisions on arterials.');
    expect(preview.originLine).toBe('Callback to “Bike-lane baseline”');
    expect(preview.removeA11yLabel.length).toBeGreaterThan(0);
  });

  it('omits the origin line when no title is known', () => {
    const preview = deriveCallbackEchoPreview(
      captureToCallback(makeCapture({ targetTitleSnapshot: '   ' })),
    );
    expect(preview.originLine).toBe('');
  });

  it('is deterministic', () => {
    const cb = captureToCallback(makeCapture());
    expect(deriveCallbackEchoPreview(cb)).toEqual(deriveCallbackEchoPreview(cb));
  });
});
