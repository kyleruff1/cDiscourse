/**
 * UX-001.2 — microMoment dismiss-on-interaction (operator override).
 *
 * The QOL-040.3 microMoment banner was originally "persistent until
 * `entryHint` changes". UX-001.2's operator override flips this to
 * "dismiss on first meaningful Timeline interaction" while keeping the
 * visual treatment, copy, accessibility behavior, and triggering logic
 * unchanged.
 *
 * Meaningful interactions:
 *   - handleActivate (node tap)
 *   - handlePrev / handleNext
 *   - handleJumpLatest / handleJumpToRoot (ASP-EXTRACT-001 lifted the former
 *     onJumpLatest / onJumpToRoot inline closures into these named handlers;
 *     the dismiss behavior is unchanged, only relocated to the handler body)
 *   - handleToggleMode (Timeline / Cards toggle)
 *   - handleOpenDetailsFromTimeline (ASP-EXTRACT-001 lifted the former
 *     onOpenDetails inline closure; opens cards detail from the Timeline)
 *
 * NOT a dismiss trigger:
 *   - initial render
 *   - the banner's own re-render
 *   - a change to entryHint itself (a NEW deep-link should re-show the
 *     banner via a reset effect)
 *   - a scroll inside the Timeline that does not change selection
 *
 * Verification approach: source-scan that the dismiss flag is set in the
 * required handler branches, plus a reset effect keyed on the entryHint
 * verbPhrase. The render condition extends to
 * `{entryHint?.verbPhrase && !microMomentDismissed ? ... : null}`.
 */
import fs from 'fs';
import path from 'path';

const REPO = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

const SURFACE_SRC = read('src/features/arguments/room/ArgumentRoom.tsx');

describe('UX-001.2 — microMomentDismissed state', () => {
  it('the surface declares a single microMomentDismissed boolean (initial false)', () => {
    expect(SURFACE_SRC).toMatch(
      /const\s*\[\s*microMomentDismissed,\s*setMicroMomentDismissed\s*\]\s*=\s*useState\(false\)/,
    );
  });

  it('only one declaration site exists', () => {
    const matches = SURFACE_SRC.match(/microMomentDismissed,\s*setMicroMomentDismissed/g) || [];
    expect(matches.length).toBe(1);
  });
});

describe('UX-001.2 — microMoment render condition extends to dismissed flag', () => {
  it('the banner JSX is gated on both verbPhrase AND !microMomentDismissed', () => {
    expect(SURFACE_SRC).toMatch(
      /entryHint\?\.verbPhrase\s*&&\s*!microMomentDismissed\s*\?/,
    );
  });
});

describe('UX-001.2 — meaningful interactions dismiss the banner', () => {
  it('handleActivate sets microMomentDismissed to true', () => {
    expect(SURFACE_SRC).toMatch(
      /const handleActivate = useCallback\(\(id: string\) => \{[\s\S]*?setActiveMessageId\(id\);[\s\S]*?setMicroMomentDismissed\(true\);[\s\S]*?\}/,
    );
  });

  it('handlePrev sets microMomentDismissed to true when the prev move resolves', () => {
    expect(SURFACE_SRC).toMatch(
      /const handlePrev = useCallback\(\(\) => \{[\s\S]*?if \(prev\) \{[\s\S]*?setMicroMomentDismissed\(true\);[\s\S]*?\}/,
    );
  });

  it('handleNext sets microMomentDismissed to true when the next move resolves', () => {
    expect(SURFACE_SRC).toMatch(
      /const handleNext = useCallback\(\(\) => \{[\s\S]*?if \(next\) \{[\s\S]*?setMicroMomentDismissed\(true\);[\s\S]*?\}/,
    );
  });

  it('handleToggleMode sets microMomentDismissed to true (Timeline / Cards switch)', () => {
    expect(SURFACE_SRC).toMatch(
      /const handleToggleMode = useCallback\(\(\) => \{[\s\S]*?setMicroMomentDismissed\(true\);[\s\S]*?\}/,
    );
  });

  it('handleJumpLatest (lifted onJumpLatest) sets microMomentDismissed to true', () => {
    // ASP-EXTRACT-001 — the former onJumpLatest inline arrow was lifted into
    // this named handler so MapView can receive it as a prop. The dismiss
    // flag is set in the handler body, verbatim from the former closure.
    expect(SURFACE_SRC).toMatch(
      /const handleJumpLatest = useCallback\(\(\) => \{[\s\S]*?if \(latestId\) \{[\s\S]*?setMicroMomentDismissed\(true\);[\s\S]*?\}/,
    );
  });

  it('handleJumpToRoot (lifted onJumpToRoot) sets microMomentDismissed to true', () => {
    // ASP-EXTRACT-001 — lifted from the former onJumpToRoot inline arrow.
    expect(SURFACE_SRC).toMatch(
      /const handleJumpToRoot = useCallback\(\(\) => \{[\s\S]*?if \(timelineMap\.rootMessageId\) \{[\s\S]*?setMicroMomentDismissed\(true\);[\s\S]*?\}/,
    );
  });

  it('handleOpenDetailsFromTimeline (lifted onOpenDetails) sets microMomentDismissed to true', () => {
    // ASP-EXTRACT-001 — lifted from the former onOpenDetails inline arrow;
    // it also switches to Stack mode (setMode('stack')) exactly as before.
    expect(SURFACE_SRC).toMatch(
      /const handleOpenDetailsFromTimeline = useCallback\(\(id: string\) => \{[\s\S]*?setMode\('stack'\);[\s\S]*?setMicroMomentDismissed\(true\);[\s\S]*?\}/,
    );
  });
});

describe('UX-001.2 — entryHint change re-shows the banner', () => {
  it('a useEffect keyed on entryHint?.verbPhrase resets microMomentDismissed to false', () => {
    expect(SURFACE_SRC).toMatch(
      /useEffect\(\(\) => \{[\s\S]*?setMicroMomentDismissed\(false\);[\s\S]*?\},\s*\[\s*entryHint\?\.verbPhrase\s*\]\)/,
    );
  });
});

describe('UX-001.2 — what does NOT dismiss the banner', () => {
  it('the initial useState value is false (banner shown on first render with verbPhrase set)', () => {
    // The microMomentDismissed state initializes to `false`, so on the
    // first render the gate `entryHint?.verbPhrase && !microMomentDismissed`
    // evaluates to `entryHint?.verbPhrase && true === entryHint?.verbPhrase`.
    // The render shows the banner if-and-only-if the verbPhrase is set.
    expect(SURFACE_SRC).toMatch(
      /\[\s*microMomentDismissed,\s*setMicroMomentDismissed\s*\]\s*=\s*useState\(false\)/,
    );
  });

  it('the microMoment block has no built-in setTimeout / animation that auto-dismisses', () => {
    const idx = SURFACE_SRC.indexOf('argument-micro-moment');
    expect(idx).toBeGreaterThan(-1);
    const block = SURFACE_SRC.slice(idx - 200, idx + 600);
    expect(block).not.toMatch(/setTimeout/);
    expect(block).not.toMatch(/Animated\./);
  });

  it('no scroll handler on ArgumentTimelineMap sets microMomentDismissed (scroll is exploration)', () => {
    // The dismiss is set by selection / nav / mode actions, not by
    // ArgumentTimelineMap's onScroll handler (which fires for pan).
    const idx = SURFACE_SRC.indexOf('onScroll=');
    if (idx > -1) {
      const block = SURFACE_SRC.slice(idx, idx + 240);
      expect(block).not.toMatch(/setMicroMomentDismissed/);
    }
    // No assertion required if onScroll is not threaded here (it lives
    // inside ArgumentTimelineMap, not bubbled).
    expect(true).toBe(true);
  });
});

describe('UX-001.2 — visual treatment + copy preserved from QOL-040.3', () => {
  it('the microMoment style block is preserved (paddingVertical 6, dark indigo bg)', () => {
    expect(SURFACE_SRC).toMatch(
      /microMoment:\s*\{\s*paddingHorizontal:\s*16,\s*paddingVertical:\s*6,\s*backgroundColor:\s*'#1e1b4b'/,
    );
  });

  it('the verbPhrase text style is preserved (fontSize 12, fontWeight 700)', () => {
    expect(SURFACE_SRC).toMatch(
      /microMomentText:\s*\{[^}]*fontSize:\s*12[^}]*fontWeight:\s*'700'/,
    );
  });

  it('the helperLine text style is preserved (fontSize 11, regular weight)', () => {
    expect(SURFACE_SRC).toMatch(
      /microMomentHelper:\s*\{[^}]*fontSize:\s*11[^}]*fontWeight:\s*'400'/,
    );
  });

  it('the testID anchor is preserved', () => {
    expect(SURFACE_SRC).toContain('testID="argument-micro-moment"');
  });

  it('the accessibilityLabel composition is preserved (verbPhrase + helperLine join)', () => {
    expect(SURFACE_SRC).toMatch(
      /entryHint\.helperLine && entryHint\.helperLine !== entryHint\.verbPhrase\s*\?\s*`\$\{entryHint\.verbPhrase\}\. \$\{entryHint\.helperLine\}`/,
    );
  });
});
