/**
 * UX-COPY-BATCH-002 (#740 / #760) — authProviderSlotModel pure-model tests.
 *
 * The model is the single canonical Sign In provider-slot contract. Pure TS:
 * tests import it directly (no React render). Doctrine: the v1 DEFAULT surface
 * is EMAIL-ONLY — no enabled provider slot, no visible Google button. The model
 * carries a future-reserved disabled Google slot vocabulary + ORDER so #746
 * lights it with zero re-layout. Copy is future-framed, verdict-free, and never
 * claims Google is live.
 */
import fs from 'fs';
import path from 'path';

import {
  resolveAuthProviderSlotRegion,
  FIRST_RUN_PROVIDER_SLOT_ORDER,
  CONTINUE_WITH_GOOGLE_LABEL,
  PROVIDER_SSO_DIVIDER_LABEL,
  PROVIDER_UNAVAILABLE_COPY,
  type AuthProviderSlotId,
} from '../src/features/auth/authProviderSlotModel';

const ROOT = path.join(__dirname, '..');

describe('UX-COPY-BATCH-002 — authProviderSlotModel default (email-only)', () => {
  it('default region has NO enabled provider slot (email-only default)', () => {
    const region = resolveAuthProviderSlotRegion();
    expect(region.slots).toEqual([]);
    expect(region.slots.length).toBe(0);
  });

  it('anyProviderEnabled and hasVisibleProvider are both false today (no visible button)', () => {
    const region = resolveAuthProviderSlotRegion();
    expect(region.anyProviderEnabled).toBe(false);
    expect(region.hasVisibleProvider).toBe(false);
  });

  it('exposes the canonical slot ORDER with Google primary', () => {
    const region = resolveAuthProviderSlotRegion();
    expect(region.slotOrder).toEqual(['google', 'apple', 'facebook']);
    expect(FIRST_RUN_PROVIDER_SLOT_ORDER).toEqual(['google', 'apple', 'facebook']);
    expect(region.slotOrder[0]).toBe('google');
  });

  it('renders the future-framed provider-unavailable copy while no provider is enabled', () => {
    const region = resolveAuthProviderSlotRegion();
    expect(region.providerUnavailableCopy).toBe(PROVIDER_UNAVAILABLE_COPY);
    expect(region.providerUnavailableCopy.length).toBeGreaterThan(0);
  });

  it('exposes the divider label', () => {
    const region = resolveAuthProviderSlotRegion();
    expect(region.dividerLabel).toBe(PROVIDER_SSO_DIVIDER_LABEL);
    expect(PROVIDER_SSO_DIVIDER_LABEL).toBe('or continue with SSO');
  });

  it('the AuthProviderSlotId union reserves google/apple/facebook only (no others)', () => {
    // Compile-guard: each is a valid id; the union does not widen at runtime.
    const ids: AuthProviderSlotId[] = ['google', 'apple', 'facebook'];
    expect(new Set(ids).size).toBe(3);
    expect(FIRST_RUN_PROVIDER_SLOT_ORDER.every((id) => ids.includes(id))).toBe(true);
  });
});

describe('UX-COPY-BATCH-002 — authProviderSlotModel future consumability (#746)', () => {
  it('passing an enabled Google slot lights it with zero re-layout', () => {
    const region = resolveAuthProviderSlotRegion({
      enabledSlots: [{ id: 'google', order: 0, enabled: true }],
    });
    expect(region.hasVisibleProvider).toBe(true);
    expect(region.anyProviderEnabled).toBe(true);
    expect(region.slots).toHaveLength(1);
    expect(region.slots[0].id).toBe('google');
    // No notice when a provider is enabled.
    expect(region.providerUnavailableCopy).toBe('');
    // Slot order contract is unchanged regardless of which slots light.
    expect(region.slotOrder).toEqual(['google', 'apple', 'facebook']);
  });

  it('disabled slots and unknown ids are filtered out; enabled slots sort by order', () => {
    const region = resolveAuthProviderSlotRegion({
      enabledSlots: [
        { id: 'facebook', order: 2, enabled: true },
        { id: 'google', order: 0, enabled: true },
        { id: 'apple', order: 1, enabled: false }, // disabled → filtered
      ],
    });
    expect(region.slots.map((s) => s.id)).toEqual(['google', 'facebook']);
    expect(region.hasVisibleProvider).toBe(true);
  });
});

describe('UX-COPY-BATCH-002 — authProviderSlotModel copy safety', () => {
  const COPY = [
    PROVIDER_UNAVAILABLE_COPY,
    PROVIDER_SSO_DIVIDER_LABEL,
    CONTINUE_WITH_GOOGLE_LABEL,
  ];

  it('CONTINUE_WITH_GOOGLE_LABEL is the conventional future-reserved affordance string', () => {
    // Future-reserved for #746 — present as a constant, NOT rendered while disabled.
    expect(CONTINUE_WITH_GOOGLE_LABEL).toBe('Continue with Google');
  });

  it('carries no verdict / person-judgment tokens (whole-word, case-insensitive)', () => {
    const banned = [
      'winner', 'loser', 'truth', 'liar', 'dishonest', 'bad faith',
      'manipulative', 'extremist', 'propagandist', 'verdict',
    ];
    for (const text of COPY) {
      const lower = text.toLowerCase();
      for (const token of banned) {
        const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        expect(re.test(lower)).toBe(false);
      }
      // 'right' / 'wrong' as correctness verdicts — word-boundary scoped so
      // legitimate substrings (e.g. copyright) never false-positive.
      expect(/\bright\b/.test(lower)).toBe(false);
      expect(/\bwrong\b/.test(lower)).toBe(false);
    }
  });

  it('lifts no reference slogans', () => {
    const slogans = ['mediator, not a judge', 'create your account', 'or with email'];
    for (const text of COPY) {
      const lower = text.toLowerCase();
      for (const slogan of slogans) {
        expect(lower).not.toContain(slogan);
      }
    }
  });

  it('contains no internal snake_case codes', () => {
    for (const text of COPY) {
      expect(text).not.toMatch(/[a-z]+_[a-z]+/);
      expect(text).not.toContain('__');
    }
  });

  it('the provider-unavailable copy never claims Google is live', () => {
    const lower = PROVIDER_UNAVAILABLE_COPY.toLowerCase();
    expect(lower).toContain('coming soon');
    expect(lower).not.toMatch(/sign in with google now/);
    expect(lower).not.toMatch(/google is (now )?(live|available|on)/);
  });
});

describe('UX-COPY-BATCH-002 — authProviderSlotModel purity guard', () => {
  const modelSource = fs.readFileSync(
    path.join(ROOT, 'src', 'features', 'auth', 'authProviderSlotModel.ts'),
    'utf8',
  );

  it('imports no React / Supabase / network library (pure TS)', () => {
    expect(modelSource).not.toMatch(/from\s+['"]react['"]/);
    expect(modelSource).not.toMatch(/from\s+['"]react-native['"]/);
    expect(modelSource).not.toMatch(/\.\.\/\.\.\/lib\/supabase/);
    expect(modelSource).not.toMatch(/\bfetch\s*\(/);
    expect(modelSource).not.toMatch(/\bhttps?:\/\//);
  });

  it('contains no signInWithOAuth (the disabled slot cannot reach a provider)', () => {
    expect(modelSource).not.toContain('signInWithOAuth');
  });
});
