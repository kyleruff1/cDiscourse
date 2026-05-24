/**
 * QOL-039 — MakePrivateConfirmation UI contract.
 *
 * Source-scan style. Asserts the confirmation modal renders the six
 * TransitionEffect bullets, picks the count-aware chime-in copy, and
 * exposes the right accessibility props.
 */
import fs from 'fs';
import path from 'path';
import { ROOM_VISIBILITY_COPY } from '../src/features/debates/roomVisibilityModel';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'debates', 'MakePrivateConfirmation.tsx'),
  'utf8',
);

describe('MakePrivateConfirmation — structural wiring', () => {
  it('renders an alert-role region for the dialog surface', () => {
    expect(SRC).toContain('accessibilityRole="alert"');
  });

  it('maps every TransitionEffect to a copy bullet via effectBullet()', () => {
    // Every effect code is handled in the switch.
    for (const effect of [
      'leaves_public_list',
      'non_participants_lose_read',
      'participants_keep_access',
      'content_unchanged',
      'one_way',
    ]) {
      expect(SRC).toContain(`case '${effect}':`);
    }
    // chime_in_branches_retained has its own count-aware path.
    expect(SRC).toContain("'chime_in_branches_retained'");
  });

  it('picks the count-aware chime-in copy variant (zero/one/many)', () => {
    expect(SRC).toContain('effect_chime_in_branches_retained_zero');
    expect(SRC).toContain('effect_chime_in_branches_retained_one');
    expect(SRC).toContain('effect_chime_in_branches_retained_many');
    // The many-variant substitutes {count}.
    expect(SRC).toMatch(/effect_chime_in_branches_retained_many\.replace\(\s*'\{count\}'/);
  });

  it('renders Cancel and Make private buttons with accessibilityRole="button"', () => {
    expect(SRC).toContain('accessibilityRole="button"');
    expect(SRC).toContain('confirmation_cancel');
    expect(SRC).toContain('confirmation_primary');
  });

  it('the primary button exposes busy state via accessibilityState', () => {
    expect(SRC).toMatch(/accessibilityState=\{\{ busy: submitting \}\}/);
  });

  it('exposes testIDs for both buttons and the modal', () => {
    expect(SRC).toContain('testID="make-private-confirmation"');
    expect(SRC).toContain('testID="make-private-cancel"');
    expect(SRC).toContain('testID="make-private-confirm"');
  });

  it('uses ≥44px tap targets on both buttons', () => {
    const matches = SRC.match(/minHeight:\s*44/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(1); // both buttons share actionButton style
  });
});

describe('MakePrivateConfirmation — disables on submit', () => {
  it('disables both buttons while submitting', () => {
    expect(SRC).toMatch(/disabled=\{submitting\}/);
  });

  it('renders an ellipsis or label as the busy indicator', () => {
    // The primary label flips to '…' while submitting.
    expect(SRC).toMatch(/submitting \? '…'/);
  });
});

describe('MakePrivateConfirmation — copy uses ROOM_VISIBILITY_COPY', () => {
  it('ROOM_VISIBILITY_COPY.confirmation_title is the dialog heading', () => {
    expect(ROOM_VISIBILITY_COPY.confirmation_title).toMatch(/argument private/i);
  });

  it('ROOM_VISIBILITY_COPY.confirmation_primary is the primary button label', () => {
    expect(ROOM_VISIBILITY_COPY.confirmation_primary).toBe('Make private');
  });

  it('ROOM_VISIBILITY_COPY.confirmation_cancel is the cancel button label', () => {
    expect(ROOM_VISIBILITY_COPY.confirmation_cancel).toBe('Cancel');
  });

  it('all six effect bullets carry plain English (no snake_case leak)', () => {
    for (const key of [
      'effect_leaves_public_list',
      'effect_non_participants_lose_read',
      'effect_participants_keep_access',
      'effect_content_unchanged',
      'effect_chime_in_branches_retained_zero',
      'effect_chime_in_branches_retained_one',
      'effect_chime_in_branches_retained_many',
      'effect_one_way',
    ]) {
      const value = (ROOM_VISIBILITY_COPY as Record<string, string>)[key];
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
      // No internal snake_case fragments.
      expect(value).not.toMatch(/[a-z]_[a-z]/);
    }
  });

  it('the one_way bullet states the change is final without scare language', () => {
    expect(ROOM_VISIBILITY_COPY.effect_one_way).toMatch(/cannot be undone/i);
    expect(ROOM_VISIBILITY_COPY.effect_one_way).not.toMatch(/warning|danger|irreversible/i);
  });
});
