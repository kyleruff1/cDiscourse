/**
 * EV-005 — AddAnnotationSheet picker tests.
 *
 * The repo's UI test discipline is pure-helper + source-scan (the pinned
 * react-test-renderer is held away from @testing-library's peer). The
 * sheet's load-bearing behaviour — eligibility gating of the option list,
 * one-radio-selection, Confirm-disabled-until-selected, the maxLength note
 * field, Escape / scrim / hardware-back close, the submitting / error
 * states, reduce-motion — is asserted here through (a) the exported copy
 * constants + the pure eligibleAnnotationKinds model and (b) a source-scan
 * of the component for the accessibility + close-path contract.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  ADD_ANNOTATION_NOTE_HINT,
  ADD_ANNOTATION_NOTE_LABEL,
  ADD_ANNOTATION_NOTE_MAX_LENGTH,
} from '../src/features/evidence/AddAnnotationSheet';
import {
  eligibleAnnotationKinds,
  OWN_BUBBLE_ANNOTATION_KINDS,
} from '../src/features/evidence/evidenceModel';

const SHEET_SRC = fs.readFileSync(
  path.join(process.cwd(), 'src/features/evidence/AddAnnotationSheet.tsx'),
  'utf8',
);

// ── Eligibility gating of the option list ─────────────────────

describe('AddAnnotationSheet — eligible-kind list', () => {
  it('an own-bubble viewer is offered exactly 3 option kinds', () => {
    const kinds = eligibleAnnotationKinds({ actorRole: 'participant_own_bubble', targetDepth: 0 });
    expect(kinds).toHaveLength(3);
    expect(kinds).toEqual(OWN_BUBBLE_ANNOTATION_KINDS);
  });

  it('an other-bubble viewer is offered all 18 option kinds', () => {
    const kinds = eligibleAnnotationKinds({
      actorRole: 'participant_other_bubble',
      targetDepth: 0,
    });
    expect(kinds).toHaveLength(18);
  });

  it('an observer is offered no option kinds (the sheet should not open)', () => {
    expect(eligibleAnnotationKinds({ actorRole: 'observer', targetDepth: 0 })).toHaveLength(0);
  });

  it('the sheet renders one Pressable option row per eligible kind', () => {
    expect(SHEET_SRC).toMatch(/eligibleKinds\.map\(\(kind\)/);
    expect(SHEET_SRC).toMatch(/add-annotation-option-\$\{kind\}/);
  });
});

// ── Radio selection contract ──────────────────────────────────

describe('AddAnnotationSheet — option-row radio contract', () => {
  it('option rows are accessibilityRole="radio" with accessibilityState.selected', () => {
    expect(SHEET_SRC).toMatch(/accessibilityRole="radio"/);
    expect(SHEET_SRC).toMatch(/accessibilityState=\{\{ selected \}\}/);
  });

  it('selecting one kind replaces the previous selection (single-select state)', () => {
    // `selectedKind` is a single value, not a set — selecting one deselects
    // the rest by construction.
    expect(SHEET_SRC).toMatch(/useState<EvidenceAnnotationKind \| null>\(null\)/);
    expect(SHEET_SRC).toMatch(/setSelectedKind\(kind\)/);
    expect(SHEET_SRC).toMatch(/const selected = selectedKind === kind/);
  });
});

// ── Confirm gating ────────────────────────────────────────────

describe('AddAnnotationSheet — Confirm gating', () => {
  it('Confirm is disabled until a kind is selected', () => {
    expect(SHEET_SRC).toMatch(/confirmDisabled = selectedKind === null \|\| isSubmitting/);
  });

  it('Confirm passes the selected kind + the note (null when empty)', () => {
    expect(SHEET_SRC).toMatch(/onSubmit\(selectedKind, trimmed\.length > 0 \? trimmed : null\)/);
  });

  it('handleConfirm is a no-op while submitting or with no kind', () => {
    expect(SHEET_SRC).toMatch(/if \(!selectedKind \|\| isSubmitting\) return/);
  });
});

// ── Note field ────────────────────────────────────────────────

describe('AddAnnotationSheet — note field', () => {
  it('the note TextInput enforces maxLength of 140', () => {
    expect(ADD_ANNOTATION_NOTE_MAX_LENGTH).toBe(140);
    expect(SHEET_SRC).toMatch(/maxLength=\{ADD_ANNOTATION_NOTE_MAX_LENGTH\}/);
  });

  it('the note field carries an accessibilityLabel', () => {
    expect(SHEET_SRC).toMatch(/accessibilityLabel=\{ADD_ANNOTATION_NOTE_LABEL\}/);
    expect(ADD_ANNOTATION_NOTE_LABEL.length).toBeGreaterThan(0);
  });

  it('the visible "describe the source, not the person" hint renders', () => {
    expect(ADD_ANNOTATION_NOTE_HINT).toBe('Describe the source, not the person.');
    expect(SHEET_SRC).toMatch(/ADD_ANNOTATION_NOTE_HINT/);
  });

  it('a live char-count is shown', () => {
    expect(SHEET_SRC).toMatch(/add-annotation-note-count/);
    expect(SHEET_SRC).toMatch(/charCount/);
  });
});

// ── Close paths ───────────────────────────────────────────────

describe('AddAnnotationSheet — close paths', () => {
  it('the scrim Pressable closes the sheet', () => {
    expect(SHEET_SRC).toMatch(/add-annotation-scrim/);
    expect(SHEET_SRC).toMatch(/accessibilityLabel="Close"/);
    expect(SHEET_SRC).toMatch(/onPress=\{onClose\}/);
  });

  it("Modal.onRequestClose is wired to onClose (covers Android back)", () => {
    expect(SHEET_SRC).toMatch(/onRequestClose=\{onClose\}/);
  });

  it('on web an Escape keydown calls onClose', () => {
    expect(SHEET_SRC).toMatch(/Platform\.OS !== 'web'/);
    expect(SHEET_SRC).toMatch(/e\.key === 'Escape'/);
    expect(SHEET_SRC).toMatch(/addEventListener\?\.\('keydown'/);
    expect(SHEET_SRC).toMatch(/removeEventListener\?\.\('keydown'/);
  });

  it('the Cancel button calls onClose', () => {
    expect(SHEET_SRC).toMatch(/add-annotation-cancel/);
  });
});

// ── Submitting / error states ─────────────────────────────────

describe('AddAnnotationSheet — submitting + error states', () => {
  it('isSubmitting disables Confirm and sets accessibilityState.busy', () => {
    expect(SHEET_SRC).toMatch(/accessibilityState=\{\{ disabled: confirmDisabled, busy: isSubmitting \}\}/);
  });

  it('isSubmitting shows a busy label on Confirm', () => {
    expect(SHEET_SRC).toMatch(/isSubmitting \? 'Adding…' : 'Confirm'/);
  });

  it('submitError renders in an accessibilityLiveRegion="polite" Text', () => {
    expect(SHEET_SRC).toMatch(/submitError \?/);
    expect(SHEET_SRC).toMatch(/accessibilityLiveRegion="polite"/);
    expect(SHEET_SRC).toMatch(/add-annotation-error/);
  });
});

// ── Accessibility + reduce-motion ─────────────────────────────

describe('AddAnnotationSheet — accessibility + reduce motion', () => {
  it('the Modal content is a modal accessibility view', () => {
    expect(SHEET_SRC).toMatch(/accessibilityViewIsModal/);
  });

  it('reduceMotion sets the Modal animationType to "none"', () => {
    expect(SHEET_SRC).toMatch(/animationType=\{reduceMotion \? 'none' : 'slide'\}/);
  });

  it('Confirm / Cancel are buttons with a 44-or-greater hit target', () => {
    expect(SHEET_SRC).toMatch(/minHeight: 44/);
    expect(SHEET_SRC).toMatch(/accessibilityRole="button"/);
  });

  it('built only from RN primitives — no third-party sheet library', () => {
    expect(SHEET_SRC).toMatch(/from 'react-native'/);
    // The Modal / Pressable / ScrollView / TextInput are all RN primitives.
    expect(SHEET_SRC).toMatch(/\bModal\b/);
    expect(SHEET_SRC).toMatch(/\bScrollView\b/);
    expect(SHEET_SRC).toMatch(/\bTextInput\b/);
    // No bottom-sheet / Supabase dependency in the import edges.
    const importLines = SHEET_SRC.split('\n').filter((l) => /^\s*import\s/.test(l));
    for (const line of importLines) {
      expect(line).not.toMatch(/bottom-sheet/i);
      expect(line).not.toMatch(/@supabase/);
    }
  });
});
