/**
 * QOL-039 — CreateDebateForm UI contract for the visibility control.
 *
 * Source-scan style (mirrors AdminCreateUserForm.test.tsx). The form's
 * pure-helper logic is covered by `roomVisibilityModel.test.ts`; this
 * file proves the JSX wires the radiogroup, accessibility props, and
 * default value the design names.
 */
import fs from 'fs';
import path from 'path';
import { ROOM_VISIBILITY_COPY } from '../src/features/debates/roomVisibilityModel';

const FORM_SRC = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'debates', 'CreateDebateForm.tsx'),
  'utf8',
);

describe('CreateDebateForm — visibility control wiring', () => {
  it('initializes visibility state to "public" (today\'s default behavior)', () => {
    expect(FORM_SRC).toMatch(/useState<RoomVisibility>\('public'\)/);
  });

  it('threads input.visibility into onSubmit', () => {
    expect(FORM_SRC).toMatch(/visibility,\s*\n/);
    expect(FORM_SRC).toMatch(/onSubmit\(\{[\s\S]*visibility,/);
  });

  it('renders a radiogroup wrapping the two options', () => {
    expect(FORM_SRC).toContain('accessibilityRole="radiogroup"');
    expect(FORM_SRC).toContain('ROOM_VISIBILITY_COPY.group_label');
  });

  it('exposes a testID anchor for the group and each option', () => {
    expect(FORM_SRC).toContain('testID="create-debate-visibility-group"');
    expect(FORM_SRC).toContain("`create-debate-visibility-${value}`");
  });

  it('renders both visibility options', () => {
    expect(FORM_SRC).toContain('option_public_label');
    expect(FORM_SRC).toContain('option_private_label');
    expect(FORM_SRC).toContain('option_public_helper');
    expect(FORM_SRC).toContain('option_private_helper');
  });
});

describe('CreateDebateForm — accessibility-targets compliance', () => {
  it('each option uses accessibilityRole="radio" with accessibilityState', () => {
    expect(FORM_SRC).toContain('accessibilityRole="radio"');
    expect(FORM_SRC).toContain('accessibilityState={{ selected, disabled: false }}');
  });

  it('each option exposes an accessibilityLabel that includes the helper text', () => {
    expect(FORM_SRC).toMatch(/accessibilityLabel=\{`\$\{label\}\. \$\{helper\}`\}/);
  });

  it('each option meets the 44px tap target via minHeight + hitSlop', () => {
    expect(FORM_SRC).toMatch(/minHeight:\s*44/);
    expect(FORM_SRC).toMatch(/hitSlop=\{\{[^}]*\}\}/);
  });

  it('selection state is conveyed by more than color (check mark + bold label)', () => {
    // accessibility-targets §3 — color is never the only signal.
    // The selected check mark uses a different glyph (●) vs unselected (○).
    expect(FORM_SRC).toMatch(/'●'\s*:\s*'○'/);
    // The selected label uses a heavier font weight.
    expect(FORM_SRC).toMatch(/fontWeight:\s*'700'/);
  });
});

describe('CreateDebateForm — ROOM_VISIBILITY_COPY copy assertions', () => {
  it('ROOM_VISIBILITY_COPY.option_public_label is the user-visible "Public" word', () => {
    expect(ROOM_VISIBILITY_COPY.option_public_label).toBe('Public');
  });

  it('ROOM_VISIBILITY_COPY.option_private_label is the user-visible "Private" word', () => {
    expect(ROOM_VISIBILITY_COPY.option_private_label).toBe('Private');
  });

  it('helper text uses plain English ("anyone" / "only people you invite")', () => {
    expect(ROOM_VISIBILITY_COPY.option_public_helper).toMatch(/anyone/i);
    expect(ROOM_VISIBILITY_COPY.option_private_helper).toMatch(/only people you invite/i);
  });

  it('helper text says "argument", not "debate" (QOL-035)', () => {
    expect(ROOM_VISIBILITY_COPY.option_public_helper).toMatch(/argument/i);
    expect(ROOM_VISIBILITY_COPY.option_public_helper).not.toMatch(/\bdebate\b/i);
    expect(ROOM_VISIBILITY_COPY.option_private_helper).toMatch(/argument/i);
    expect(ROOM_VISIBILITY_COPY.option_private_helper).not.toMatch(/\bdebate\b/i);
  });
});
