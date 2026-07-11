/**
 * UX-FLAGS-004 (#836) — flagComposerIntentMap cross-coverage manifest.
 *
 * The drift guard (QA-001 executable-manifest style). Actionability is DERIVED
 * from the #833 friendlyFlagMap descriptors, never re-declared here, so an
 * actionable flag added to #833 without a matching intent (or vice-versa) is a
 * RED CI, not a silent gap. Also proves every resolved intent yields a seeded
 * (non-empty body) MoveDraftPatch from the PRODUCTION quickActionToPreset — real
 * derivation, never a fixture echo — plus a firing negative control.
 */
import {
  FRIENDLY_FLAG_DESCRIPTORS,
  ALL_FRIENDLY_FLAG_KEYS,
  resolveFlagComposerIntent,
  flagIntentForKey,
  isComposerIntentCode,
  FLAG_INTENT_TO_QUICK_ACTION,
  ALL_COMPOSER_INTENT_CODES,
  type ComposerIntentCode,
} from '../src/features/feedbackFlags';
import { quickActionToPreset } from '../src/features/arguments/quickActionPresets';

describe('flagComposerIntentMap — cross-coverage manifest (no drift vs #833)', () => {
  it('resolveFlagComposerIntent is non-null IFF the descriptor is actionable, and the intent matches', () => {
    for (const key of ALL_FRIENDLY_FLAG_KEYS) {
      const descriptor = FRIENDLY_FLAG_DESCRIPTORS[key];
      const resolved = resolveFlagComposerIntent(descriptor);
      if (descriptor.actionable === true) {
        expect(resolved).not.toBeNull();
        expect(resolved?.intent).toBe(descriptor.composerIntent);
      } else {
        expect(resolved).toBeNull();
      }
    }
  });

  it('flagIntentForKey agrees with resolveFlagComposerIntent for every descriptor key', () => {
    for (const key of ALL_FRIENDLY_FLAG_KEYS) {
      expect(flagIntentForKey(key)).toEqual(resolveFlagComposerIntent(FRIENDLY_FLAG_DESCRIPTORS[key]));
    }
  });

  it('the set of actionable descriptor composerIntents EQUALS the ComposerIntentCode set (both directions)', () => {
    const fromDescriptors = new Set<string>();
    for (const key of ALL_FRIENDLY_FLAG_KEYS) {
      const d = FRIENDLY_FLAG_DESCRIPTORS[key];
      if (d.actionable === true && d.composerIntent) fromDescriptors.add(d.composerIntent);
    }
    const fromMap = new Set<string>(ALL_COMPOSER_INTENT_CODES);
    expect([...fromDescriptors].sort()).toEqual([...fromMap].sort());
  });

  it('every non-null composerIntent present in the descriptor table is a known ComposerIntentCode', () => {
    for (const key of ALL_FRIENDLY_FLAG_KEYS) {
      const intent = FRIENDLY_FLAG_DESCRIPTORS[key].composerIntent;
      if (intent === null) continue;
      // Only actionable descriptors are wired; a non-actionable descriptor may
      // still carry null. Guard the actionable ones.
      if (FRIENDLY_FLAG_DESCRIPTORS[key].actionable === true) {
        expect(isComposerIntentCode(intent)).toBe(true);
      }
    }
  });

  it('every ComposerIntentCode maps to a QuickActionLabel whose preset seeds a NON-EMPTY body (real derivation)', () => {
    for (const code of ALL_COMPOSER_INTENT_CODES) {
      const quickAction = FLAG_INTENT_TO_QUICK_ACTION[code];
      expect(quickAction).toBeTruthy();
      const preset = quickActionToPreset(quickAction, null);
      expect(preset).not.toBeNull();
      expect(typeof preset?.body).toBe('string');
      expect((preset?.body ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  it('exposes exactly the five expected intent codes', () => {
    expect([...ALL_COMPOSER_INTENT_CODES].sort()).toEqual(
      ['answer_question', 'ask_clarify', 'ask_for_source', 'propose_synthesis', 'sharpen_claim'].sort(),
    );
  });
});

describe('flagComposerIntentMap — firing negative control (non-actionable flags never resolve)', () => {
  // Representative non-actionable flags across families A / B / I (plus a
  // challenge-adjacent A flag). None carry a composer intent, so a pill for any
  // of them must never become a button.
  const NON_ACTIONABLE: string[] = ['nice_bridge', 'direct_challenge', 'disagrees_on_scope', 'new_issue'];

  it('resolveFlagComposerIntent + flagIntentForKey both return null for representative non-actionable flags', () => {
    for (const key of NON_ACTIONABLE) {
      expect(resolveFlagComposerIntent(FRIENDLY_FLAG_DESCRIPTORS[key as never])).toBeNull();
      expect(flagIntentForKey(key)).toBeNull();
    }
  });

  it('flagIntentForKey returns null for an unknown / future flag key', () => {
    expect(flagIntentForKey('totally_unknown_flag')).toBeNull();
    expect(flagIntentForKey('')).toBeNull();
  });
});

describe('flagComposerIntentMap — isComposerIntentCode', () => {
  const VALID: ComposerIntentCode[] = [
    'ask_for_source',
    'ask_clarify',
    'answer_question',
    'propose_synthesis',
    'sharpen_claim',
  ];

  it('accepts the five intent codes', () => {
    for (const code of VALID) expect(isComposerIntentCode(code)).toBe(true);
  });

  it('rejects empty / null / a QuickActionLabel that is not an intent code / unknown', () => {
    expect(isComposerIntentCode('')).toBe(false);
    expect(isComposerIntentCode(null)).toBe(false);
    expect(isComposerIntentCode(undefined)).toBe(false);
    // 'source' is the QuickActionLabel the ask_for_source intent maps TO, not an
    // intent code itself.
    expect(isComposerIntentCode('source')).toBe(false);
    expect(isComposerIntentCode('synthesize')).toBe(false);
    expect(isComposerIntentCode('nope')).toBe(false);
    expect(isComposerIntentCode(42 as unknown)).toBe(false);
  });

  it('is deterministic (same input => same output)', () => {
    for (const code of VALID) {
      expect(isComposerIntentCode(code)).toBe(isComposerIntentCode(code));
    }
    expect(resolveFlagComposerIntent(FRIENDLY_FLAG_DESCRIPTORS.needs_a_receipt)).toEqual(
      resolveFlagComposerIntent(FRIENDLY_FLAG_DESCRIPTORS.needs_a_receipt),
    );
  });
});
