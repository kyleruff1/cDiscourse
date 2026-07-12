/**
 * UX-PR-G (#920) P1-10 — gallery "Voices" (participant count) derivation.
 *
 * The field was never wired (always 0). It now derives the DISTINCT non-null
 * poster count from the already-fetched rows. Critically, the heat input line
 * still reads the raw `participantCountByDebateId` map (NOT the derived display
 * count), so heat / bucket / lane stay byte-identical — proven below by varying
 * the derived count while the raw map stays empty and asserting heat is unmoved.
 */
import {
  buildConversationGalleryCards,
  type GalleryArgumentInput,
} from '../src/features/debates/conversationGalleryModel';
import type { Debate } from '../src/features/debates/types';

function isoAt(ms: number): string {
  return new Date(ms).toISOString();
}
const BASE = 1715000000000;

function debate(partial: Partial<Debate> & { id: string }): Debate {
  return {
    id: partial.id,
    createdBy: partial.createdBy ?? 'user-creator',
    title: partial.title ?? 'A debate title',
    resolution: partial.resolution ?? 'A debate resolution.',
    description: partial.description ?? '',
    status: partial.status ?? 'open',
    constitutionId: partial.constitutionId ?? 'c1',
    createdAt: partial.createdAt ?? isoAt(BASE),
    updatedAt: partial.updatedAt ?? isoAt(BASE),
    myParticipantSide: partial.myParticipantSide ?? null,
    visibility: partial.visibility ?? 'public',
    inactiveAt: partial.inactiveAt ?? null,
  };
}

function arg(partial: Partial<GalleryArgumentInput> & { id: string; debateId: string }): GalleryArgumentInput {
  return {
    id: partial.id,
    debateId: partial.debateId,
    parentId: partial.parentId ?? null,
    // Preserve an explicitly-passed null authorId (?? would coalesce it away).
    authorId: 'authorId' in partial ? (partial.authorId ?? null) : 'author-a',
    argumentType: partial.argumentType ?? 'thesis',
    side: partial.side ?? 'affirmative',
    body: partial.body ?? 'A reasonably sized argument body for the room.',
    status: partial.status ?? 'posted',
    createdAt: partial.createdAt ?? isoAt(BASE),
    updatedAt: partial.updatedAt ?? null,
  };
}

/** Three-move thread with the caller-chosen author list; identical structure. */
function threadWithAuthors(authors: Array<string | null>): GalleryArgumentInput[] {
  return [
    arg({ id: 'm-root', debateId: 'd1', parentId: null, authorId: authors[0], argumentType: 'thesis', createdAt: isoAt(BASE) }),
    arg({ id: 'm-r1', debateId: 'd1', parentId: 'm-root', authorId: authors[1], argumentType: 'rebuttal', createdAt: isoAt(BASE + 1000) }),
    arg({ id: 'm-r2', debateId: 'd1', parentId: 'm-root', authorId: authors[2], argumentType: 'rebuttal', createdAt: isoAt(BASE + 2000) }),
  ];
}

function buildOne(messages: GalleryArgumentInput[], participantCountByDebateId?: Record<string, number>) {
  const cards = buildConversationGalleryCards({
    debates: [debate({ id: 'd1' })],
    argumentsByDebateId: { d1: messages },
    participantCountByDebateId,
  });
  return cards[0];
}

describe('UX-PR-G P1-10 — derived Voices (distinct-poster) count', () => {
  it('two distinct authors across three messages -> participantCount 2', () => {
    const card = buildOne(threadWithAuthors(['author-a', 'author-b', 'author-a']));
    expect(card.participantCount).toBe(2);
  });

  it('a single self-posted thread -> participantCount 1', () => {
    const card = buildOne(threadWithAuthors(['author-a', 'author-a', 'author-a']));
    expect(card.participantCount).toBe(1);
  });

  it('ignores null / anonymous authorIds (participantCount 0 when none attributable)', () => {
    const card = buildOne(threadWithAuthors([null, null, null]));
    expect(card.participantCount).toBe(0);
  });

  it('a supplied participantCountByDebateId override wins over the derivation', () => {
    const card = buildOne(threadWithAuthors(['author-a', 'author-b', 'author-c']), { d1: 9 });
    expect(card.participantCount).toBe(9);
  });
});

describe('UX-PR-G P1-10 — heat / bucket stay decoupled from the display count', () => {
  it('varying the derived Voices count (empty raw map) does NOT move heat or bucket', () => {
    // Identical thread STRUCTURE; only the author list differs, so the ONLY
    // thing that changes is the derived distinct-poster display count. The heat
    // term reads the raw participantCountByDebateId map (empty -> 0 in both),
    // so heat / bucket must be byte-identical.
    const twoVoices = buildOne(threadWithAuthors(['author-a', 'author-b', 'author-a']));
    const threeVoices = buildOne(threadWithAuthors(['author-a', 'author-b', 'author-c']));

    expect(twoVoices.participantCount).toBe(2);
    expect(threeVoices.participantCount).toBe(3);

    // The decoupling proof: display differs (2 vs 3) but heat + bucket do not.
    expect(twoVoices.heatLevel).toBe(threeVoices.heatLevel);
    expect(twoVoices.bucket).toBe(threeVoices.bucket);
    expect(twoVoices.temperament).toBe(threeVoices.temperament);
  });
});
