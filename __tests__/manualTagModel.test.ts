/**
 * META-001 — Manual tag model tests.
 *
 * Pure-model tests, no React / Supabase / network. Covers:
 *   - The eligibility matrix (80 cases — 10 tags × 4 actor roles × 2
 *     own-bubble values).
 *   - `isApplyAllowed` semantics for each actor role / own-bubble combo.
 *   - `makeManualTagDedupeKey` stability + per-user uniqueness.
 *   - `MANUAL_TAG_ELIGIBILITY` exposes all 10 tag records.
 *   - Observer applier is universally refused.
 *   - Admin applier is universally allowed.
 *   - Own-bubble restriction set: only `concession_offered`,
 *     `narrowed_claim`, `ready_for_synthesis`.
 */

import {
  ALL_MANUAL_TAG_CODES,
  MANUAL_TAG_ELIGIBILITY,
  getManualTagEligibility,
  isApplyAllowed,
  makeManualTagDedupeKey,
  type ManualTagActorRole,
  type ManualTagCode,
  type EligibilityContext,
} from '../src/features/metadata';

const OWN_BUBBLE_ALLOWED_TAGS: ReadonlyArray<ManualTagCode> = [
  'concession_offered',
  'narrowed_claim',
  'ready_for_synthesis',
];

const ACTOR_ROLES: ReadonlyArray<ManualTagActorRole> = [
  'participant_affirmative',
  'participant_negative',
  'observer',
  'admin',
];

function ctx(role: ManualTagActorRole, isOwnBubble: boolean): EligibilityContext {
  return {
    applierUserId: 'user-test',
    applierActorRole: role,
    isOwnBubble,
  };
}

// ── Eligibility matrix structure ──────────────────────────────

describe('META-001 manual tag eligibility matrix structure', () => {
  it('exposes a record for every manual tag code', () => {
    for (const c of ALL_MANUAL_TAG_CODES) {
      expect(MANUAL_TAG_ELIGIBILITY[c]).toBeDefined();
      const rec = MANUAL_TAG_ELIGIBILITY[c];
      expect(typeof rec.allowOnOwnBubble).toBe('boolean');
      expect(typeof rec.allowOnOtherBubble).toBe('boolean');
      expect(typeof rec.allowObserver).toBe('boolean');
      expect(typeof rec.allowAdmin).toBe('boolean');
    }
  });

  it('getManualTagEligibility returns the same record per code', () => {
    for (const c of ALL_MANUAL_TAG_CODES) {
      expect(getManualTagEligibility(c)).toBe(MANUAL_TAG_ELIGIBILITY[c]);
    }
  });

  it('every tag denies observers (observers may NEVER apply tags in v1)', () => {
    for (const c of ALL_MANUAL_TAG_CODES) {
      expect(MANUAL_TAG_ELIGIBILITY[c].allowObserver).toBe(false);
    }
  });

  it('every tag allows admins (admins may apply all 10 codes)', () => {
    for (const c of ALL_MANUAL_TAG_CODES) {
      expect(MANUAL_TAG_ELIGIBILITY[c].allowAdmin).toBe(true);
    }
  });

  it('every tag allows participants on other-bubble (challenge surface)', () => {
    for (const c of ALL_MANUAL_TAG_CODES) {
      expect(MANUAL_TAG_ELIGIBILITY[c].allowOnOtherBubble).toBe(true);
    }
  });

  it('exactly 3 tags allow own-bubble: concession_offered / narrowed_claim / ready_for_synthesis', () => {
    const own: ManualTagCode[] = [];
    for (const c of ALL_MANUAL_TAG_CODES) {
      if (MANUAL_TAG_ELIGIBILITY[c].allowOnOwnBubble) own.push(c);
    }
    expect(own.sort()).toEqual(['concession_offered', 'narrowed_claim', 'ready_for_synthesis']);
  });
});

// ── 80-case eligibility matrix coverage ───────────────────────

describe('META-001 isApplyAllowed — full 80-case matrix', () => {
  for (const code of ALL_MANUAL_TAG_CODES) {
    for (const role of ACTOR_ROLES) {
      for (const isOwn of [false, true] as const) {
        const label = `${code} | role=${role} | isOwnBubble=${isOwn}`;
        it(label, () => {
          const allowed = isApplyAllowed(code, ctx(role, isOwn));
          const expected = computeExpected(code, role, isOwn);
          expect(allowed).toBe(expected);
        });
      }
    }
  }
});

function computeExpected(
  code: ManualTagCode,
  role: ManualTagActorRole,
  isOwnBubble: boolean,
): boolean {
  if (role === 'observer') return false;
  if (role === 'admin') return true;
  // Participant.
  if (isOwnBubble) {
    return OWN_BUBBLE_ALLOWED_TAGS.includes(code);
  }
  return true;
}

// ── Observer + admin universal behavior ───────────────────────

describe('META-001 isApplyAllowed — universal behavior', () => {
  it('observer is refused for every tag, on own or other bubble', () => {
    for (const code of ALL_MANUAL_TAG_CODES) {
      expect(isApplyAllowed(code, ctx('observer', false))).toBe(false);
      expect(isApplyAllowed(code, ctx('observer', true))).toBe(false);
    }
  });

  it('admin is allowed for every tag, on own or other bubble', () => {
    for (const code of ALL_MANUAL_TAG_CODES) {
      expect(isApplyAllowed(code, ctx('admin', false))).toBe(true);
      expect(isApplyAllowed(code, ctx('admin', true))).toBe(true);
    }
  });

  it('participants (aff + neg) behave identically', () => {
    for (const code of ALL_MANUAL_TAG_CODES) {
      for (const isOwn of [false, true] as const) {
        expect(isApplyAllowed(code, ctx('participant_affirmative', isOwn)))
          .toBe(isApplyAllowed(code, ctx('participant_negative', isOwn)));
      }
    }
  });

  it('participants on own bubble: only 3 tags allowed', () => {
    for (const code of ALL_MANUAL_TAG_CODES) {
      const allowed = isApplyAllowed(code, ctx('participant_affirmative', true));
      const expected = OWN_BUBBLE_ALLOWED_TAGS.includes(code);
      expect(allowed).toBe(expected);
    }
  });
});

// ── Dedupe key ────────────────────────────────────────────────

describe('META-001 makeManualTagDedupeKey', () => {
  it('returns the same string across two calls with same args', () => {
    expect(makeManualTagDedupeKey('needs_source', 'user-1'))
      .toBe(makeManualTagDedupeKey('needs_source', 'user-1'));
  });

  it('different users produce different keys', () => {
    expect(makeManualTagDedupeKey('needs_source', 'user-1'))
      .not.toBe(makeManualTagDedupeKey('needs_source', 'user-2'));
  });

  it('different codes produce different keys', () => {
    expect(makeManualTagDedupeKey('needs_source', 'user-1'))
      .not.toBe(makeManualTagDedupeKey('needs_quote', 'user-1'));
  });

  it('encodes code + user id', () => {
    expect(makeManualTagDedupeKey('needs_source', 'user-1')).toBe('needs_source:user-1');
  });

  it('the same applier cannot accidentally collide via similar prefixes', () => {
    // "u1" vs "u1:x" — colon separator means we'd need both pieces to
    // match exactly.
    const a = makeManualTagDedupeKey('needs_source', 'u1');
    const b = makeManualTagDedupeKey('needs_source', 'u1:x');
    expect(a).not.toBe(b);
  });
});

// ── Per-tag eligibility details ───────────────────────────────

describe('META-001 per-tag eligibility — concession_offered (own + other)', () => {
  it('own bubble allowed', () => {
    expect(MANUAL_TAG_ELIGIBILITY.concession_offered.allowOnOwnBubble).toBe(true);
  });

  it('other bubble allowed', () => {
    expect(MANUAL_TAG_ELIGIBILITY.concession_offered.allowOnOtherBubble).toBe(true);
  });

  it('observer denied', () => {
    expect(MANUAL_TAG_ELIGIBILITY.concession_offered.allowObserver).toBe(false);
  });

  it('admin allowed', () => {
    expect(MANUAL_TAG_ELIGIBILITY.concession_offered.allowAdmin).toBe(true);
  });
});

describe('META-001 per-tag eligibility — needs_source (no own-bubble)', () => {
  it('own bubble denied', () => {
    expect(MANUAL_TAG_ELIGIBILITY.needs_source.allowOnOwnBubble).toBe(false);
  });

  it('other bubble allowed', () => {
    expect(MANUAL_TAG_ELIGIBILITY.needs_source.allowOnOtherBubble).toBe(true);
  });
});

describe('META-001 per-tag eligibility — evidence_debt (no own-bubble)', () => {
  it('own bubble denied', () => {
    expect(MANUAL_TAG_ELIGIBILITY.evidence_debt.allowOnOwnBubble).toBe(false);
  });

  it('other bubble allowed', () => {
    expect(MANUAL_TAG_ELIGIBILITY.evidence_debt.allowOnOtherBubble).toBe(true);
  });
});

describe('META-001 per-tag eligibility — tangent (no own-bubble)', () => {
  it('own bubble denied', () => {
    expect(MANUAL_TAG_ELIGIBILITY.tangent.allowOnOwnBubble).toBe(false);
  });

  it('other bubble allowed', () => {
    expect(MANUAL_TAG_ELIGIBILITY.tangent.allowOnOtherBubble).toBe(true);
  });
});
