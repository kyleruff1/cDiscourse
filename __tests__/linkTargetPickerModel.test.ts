/**
 * QUOTE-FORGE-001 — linkTargetPickerModel tests (pure model).
 *
 * Covers segmentation (same-circle first), the null-circle fall-through
 * (every candidate into `other`, not empty-by-construction), the 20-cap
 * with `moreNotShown`, the empty-input path, defensive current-id exclusion,
 * and determinism.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildLinkTargetPickerModel,
  canCreatePriorLink,
  MAX_LINK_TARGET_CANDIDATES,
  type LinkTargetCandidate,
} from '../src/features/arguments/crossRoom/linkTargetPickerModel';

function candidate(over: Partial<LinkTargetCandidate> = {}): LinkTargetCandidate {
  return {
    debateId: over.debateId ?? 'd1',
    title: over.title ?? 'A prior argument',
    circleId: over.circleId ?? null,
    sameCircle: over.sameCircle ?? false,
  };
}

describe('buildLinkTargetPickerModel — segmentation', () => {
  it('puts same-circle candidates first, rest into other', () => {
    const candidates: LinkTargetCandidate[] = [
      candidate({ debateId: 'a', circleId: 'c1' }),
      candidate({ debateId: 'b', circleId: null }),
      candidate({ debateId: 'c', circleId: 'c1' }),
      candidate({ debateId: 'd', circleId: 'c2' }),
    ];
    const model = buildLinkTargetPickerModel(candidates, 'c1');
    expect(model.sameCircle.map((c) => c.debateId)).toEqual(['a', 'c']);
    expect(model.other.map((c) => c.debateId)).toEqual(['b', 'd']);
    expect(model.sameCircle.every((c) => c.sameCircle)).toBe(true);
    expect(model.other.every((c) => !c.sameCircle)).toBe(true);
    expect(model.isEmpty).toBe(false);
    expect(model.moreNotShown).toBe(false);
  });

  it('preserves input order within each segment', () => {
    const candidates: LinkTargetCandidate[] = [
      candidate({ debateId: 'z', circleId: 'c1' }),
      candidate({ debateId: 'y', circleId: 'c1' }),
    ];
    const model = buildLinkTargetPickerModel(candidates, 'c1');
    expect(model.sameCircle.map((c) => c.debateId)).toEqual(['z', 'y']);
  });
});

describe('buildLinkTargetPickerModel — null current circle (today data)', () => {
  it('routes every candidate into other when currentCircleId is null', () => {
    const candidates: LinkTargetCandidate[] = [
      candidate({ debateId: 'a', circleId: null }),
      candidate({ debateId: 'b', circleId: 'c1' }),
    ];
    const model = buildLinkTargetPickerModel(candidates, null);
    expect(model.sameCircle).toHaveLength(0);
    expect(model.other.map((c) => c.debateId)).toEqual(['a', 'b']);
    // Not empty-by-construction: candidates still surface.
    expect(model.isEmpty).toBe(false);
  });

  it('treats an empty-string currentCircleId as null', () => {
    const model = buildLinkTargetPickerModel([candidate({ circleId: 'c1' })], '');
    expect(model.sameCircle).toHaveLength(0);
    expect(model.other).toHaveLength(1);
  });
});

describe('buildLinkTargetPickerModel — cap + moreNotShown', () => {
  it('caps at MAX and flags moreNotShown when raw count exceeds it', () => {
    const raw: LinkTargetCandidate[] = [];
    for (let i = 0; i < MAX_LINK_TARGET_CANDIDATES + 1; i++) {
      raw.push(candidate({ debateId: `d${i}`, circleId: null }));
    }
    const model = buildLinkTargetPickerModel(raw, null);
    expect(model.sameCircle.length + model.other.length).toBe(MAX_LINK_TARGET_CANDIDATES);
    expect(model.moreNotShown).toBe(true);
  });

  it('keeps same-circle candidates ahead of others when the cap trims', () => {
    const raw: LinkTargetCandidate[] = [];
    // 5 same-circle, then MAX others — the cap should keep all 5 same-circle.
    for (let i = 0; i < 5; i++) raw.push(candidate({ debateId: `s${i}`, circleId: 'c1' }));
    for (let i = 0; i < MAX_LINK_TARGET_CANDIDATES; i++) {
      raw.push(candidate({ debateId: `o${i}`, circleId: null }));
    }
    const model = buildLinkTargetPickerModel(raw, 'c1');
    expect(model.sameCircle).toHaveLength(5);
    expect(model.other).toHaveLength(MAX_LINK_TARGET_CANDIDATES - 5);
    expect(model.moreNotShown).toBe(true);
  });

  it('does not flag moreNotShown at exactly MAX', () => {
    const raw: LinkTargetCandidate[] = [];
    for (let i = 0; i < MAX_LINK_TARGET_CANDIDATES; i++) {
      raw.push(candidate({ debateId: `d${i}`, circleId: null }));
    }
    const model = buildLinkTargetPickerModel(raw, null);
    expect(model.moreNotShown).toBe(false);
    expect(model.other).toHaveLength(MAX_LINK_TARGET_CANDIDATES);
  });
});

describe('buildLinkTargetPickerModel — empty + defensive', () => {
  it('returns isEmpty for an empty array', () => {
    const model = buildLinkTargetPickerModel([], null);
    expect(model.isEmpty).toBe(true);
    expect(model.sameCircle).toHaveLength(0);
    expect(model.other).toHaveLength(0);
    expect(model.moreNotShown).toBe(false);
  });

  it('returns isEmpty for a non-array input defensively', () => {
    const model = buildLinkTargetPickerModel(null as unknown as LinkTargetCandidate[], null);
    expect(model.isEmpty).toBe(true);
  });

  it('drops the current room id if it somehow appears in the candidate list', () => {
    const candidates: LinkTargetCandidate[] = [
      candidate({ debateId: 'current', circleId: null }),
      candidate({ debateId: 'other', circleId: null }),
    ];
    const model = buildLinkTargetPickerModel(candidates, null, 'current');
    expect(model.other.map((c) => c.debateId)).toEqual(['other']);
  });

  it('drops candidates with a blank debateId', () => {
    const candidates: LinkTargetCandidate[] = [
      candidate({ debateId: '', circleId: null }),
      candidate({ debateId: 'ok', circleId: null }),
    ];
    const model = buildLinkTargetPickerModel(candidates, null);
    expect(model.other.map((c) => c.debateId)).toEqual(['ok']);
  });
});

describe('buildLinkTargetPickerModel — determinism', () => {
  it('returns equal output for equal input', () => {
    const candidates = [candidate({ debateId: 'a', circleId: 'c1' })];
    expect(buildLinkTargetPickerModel(candidates, 'c1')).toEqual(
      buildLinkTargetPickerModel(candidates, 'c1'),
    );
  });

  it('does not mutate the input array', () => {
    const candidates = [candidate({ debateId: 'a', circleId: 'c1' })];
    const snapshot = JSON.parse(JSON.stringify(candidates));
    buildLinkTargetPickerModel(candidates, 'c1');
    expect(candidates).toEqual(snapshot);
  });
});

describe('canCreatePriorLink — link-create eligibility (reviewer blocker regression)', () => {
  it('grants the room HOST (side moderator) create eligibility — is_debate_participant is side-agnostic', () => {
    // The host/creator is seated in debate_participants with side
    // moderator (ARG-ROOM-002); the INSERT RLS permits their create.
    expect(canCreatePriorLink('moderator')).toBe(true);
  });

  it('grants seated debaters on either side', () => {
    expect(canCreatePriorLink('affirmative')).toBe(true);
    expect(canCreatePriorLink('negative')).toBe(true);
  });

  it('denies observers (not seated; INSERT RLS would reject)', () => {
    expect(canCreatePriorLink('observer')).toBe(false);
  });

  it('denies absent side (null / undefined / empty)', () => {
    expect(canCreatePriorLink(null)).toBe(false);
    expect(canCreatePriorLink(undefined)).toBe(false);
    expect(canCreatePriorLink('')).toBe(false);
  });

  it('ArgumentTreeScreen derives the create gate from canCreatePriorLink and never re-excludes side moderator', () => {
    const source = readFileSync(
      join(__dirname, '..', 'src', 'features', 'arguments', 'ArgumentTreeScreen.tsx'),
      'utf8',
    );
    expect(source).toContain('canCreatePriorLink(participantSide)');
    // Pin the blocker fix: no local re-derivation that excludes the host.
    const linkGateReDerivation = /isParticipant\s*=[^;]*moderator/;
    expect(source).not.toMatch(linkGateReDerivation);
  });
});
