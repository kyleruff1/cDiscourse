/**
 * UX-PR-G (#920) — mirror-parity proof.
 *
 * Before this card, THREE modules each carried a private regex copy of the
 * corpus-runner title-tag family:
 *   - botRoomPolicyModel.looksLikeBotSeedTag       (had reseed)
 *   - conversationGalleryModel.cleanTitleForDedupe (had reseed)
 *   - argumentArtifactModel.cleanArtifactTitleForDedupe (MISSING reseed — drift)
 *
 * All three now delegate to fixtureTagRegistry. This array-diff test asserts
 * that, over a shared corpus, the predicate and BOTH strip functions agree on
 * every title — which would have FAILED for argumentArtifactModel on the reseed
 * cases before the fix. It is the durable guard against re-drift.
 */
import { looksLikeBotSeedTag, stripFixtureTag } from '../src/features/debates/fixtureTagRegistry';
import { cleanTitleForDedupe } from '../src/features/debates/conversationGalleryModel';
import { cleanArtifactTitleForDedupe } from '../src/features/arguments/argumentArtifactModel';

const CORPUS: ReadonlyArray<string> = [
  // fixture-tagged (all four families)
  'Bike lanes are better [xai-adv 9018694f c45188c5]',
  'Pitch clock changed pacing [ai-corpus fa172432 ai-seed]',
  'Sports debate [stress-2026-05-17 #scenario-7]',
  'Remote work productivity [reseed-baseline-20260708-1a2b3c4d]',
  'Nuclear power tradeoffs [reseed-sonnet-20260708-deadbeef]',
  'Housing supply [reseed-some-scenario-20260708-00ab12cd]',
  'Topic [scenario-12 detail]',
  'Chime cohort smoke [stress chime-mrgpodh6]',
  // NOT fixture-tagged
  'Should cities expand bike lanes?',
  'Is the pitch clock good for baseball?',
  'A talk about how to reseed your lawn in spring',
  '[2024] budget debate',
  'Re: [urgent] housing',
  '  spaced   title  ',
];

describe('UX-PR-G — three former regex mirrors now agree (parity)', () => {
  it('predicate + both strip functions produce identical results per title', () => {
    for (const title of CORPUS) {
      const registryStripped = stripFixtureTag(title);
      const galleryStripped = cleanTitleForDedupe(title);
      const artifactStripped = cleanArtifactTitleForDedupe(title);

      // Both delegated strip functions are byte-identical to the registry.
      expect(galleryStripped).toBe(registryStripped);
      expect(artifactStripped).toBe(registryStripped);

      // The predicate agrees with "the strip changed the normalised title".
      const normalised = String(title || '').replace(/\s+/g, ' ').trim();
      const predicate = looksLikeBotSeedTag(title);
      expect(galleryStripped !== normalised).toBe(predicate);
      expect(artifactStripped !== normalised).toBe(predicate);
    }
  });

  it('the reseed family strips in ALL three consumers (the drift that is now fixed)', () => {
    // argumentArtifactModel.cleanArtifactTitleForDedupe previously LACKED the
    // reseed alternative, so these would NOT have folded there before the fix.
    const reseedTitles = [
      'Remote work productivity [reseed-baseline-20260708-1a2b3c4d]',
      'Nuclear power tradeoffs [reseed-sonnet-20260708-deadbeef]',
      'Housing supply [reseed-some-scenario-20260708-00ab12cd]',
    ];
    for (const title of reseedTitles) {
      expect(looksLikeBotSeedTag(title)).toBe(true);
      expect(cleanTitleForDedupe(title)).not.toContain('reseed');
      expect(cleanArtifactTitleForDedupe(title)).not.toContain('reseed');
      expect(cleanArtifactTitleForDedupe(title)).toBe(stripFixtureTag(title));
    }
  });
});
