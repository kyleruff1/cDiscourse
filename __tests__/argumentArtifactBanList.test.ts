/**
 * ADMIN-ARGS-CANONICAL-001 — ban-list + non-exposure scan over the artifact
 * projection (doctrine §1/§3/§10a).
 *
 * Two guarantees:
 *   1. No verdict / truth / popularity token (winner/loser/liar/dishonest/
 *      bad faith/manipulative/extremist/propagandist/stupid/idiot) appears in
 *      ANY rendered artifact string (latestBody excerpt, qualifiers, the
 *      structural badge strings the UI builds from the model).
 *   2. The literal `inactiveReason` / `inactive_reason` NEVER appears as a
 *      key OR value anywhere in the serialized artifact output — even when
 *      the source rows are fed poisoned reason text (the field is not on the
 *      input type, so we feed it via an `as any` widening to prove the model
 *      drops it).
 */
import {
  groupArgumentsIntoArtifacts,
  type ArtifactSourceRow,
  type ArgumentArtifact,
} from '../src/features/arguments/argumentArtifactModel';

const BANNED_VERDICT_TOKENS = [
  'winner', 'loser', 'liar', 'dishonest', 'bad faith',
  'manipulative', 'extremist', 'propagandist', 'stupid', 'idiot',
];

// The structural badge strings the AdminArgumentsTab builds from the model.
// We reproduce them here so the ban-list scan covers what is rendered.
function renderArtifactBadgeStrings(a: ArgumentArtifact): string[] {
  const out: string[] = [];
  out.push(`${a.updateCount} updates`);
  out.push(`${a.duplicateRunCount} duplicate runs collapsed`);
  out.push(
    a.observationCount.total > 0
      ? `${a.observationCount.covered}/${a.observationCount.total} observations`
      : 'observations n/a',
  );
  out.push(a.isInactive ? 'Inactive' : 'Active');
  out.push(a.latestBody);
  for (const q of a.qualifiers) out.push(q);
  if (a.debateTitle) out.push(a.debateTitle);
  for (const rev of a.revisions) out.push(rev.body);
  return out;
}

function poisonedRows(): ArtifactSourceRow[] {
  // Feed `inactive_reason` / `inactiveReason` via a widened cast — they are
  // NOT on the input type. This proves the model never reads or echoes them.
  const r1 = {
    id: 'arg-p', debateId: 'd1', debateTitle: 'A normal structural debate title',
    authorId: 'u1', body: 'A normal on-topic claim about curb space.',
    createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-02T00:00:00Z',
    inactiveAt: '2026-06-05T00:00:00Z',
    inactiveReason: 'policy_violation',
    inactive_reason: 'spam',
    selectedTagCodes: ['scope_narrowing', 'quote_anchors_parent'],
  } as unknown as ArtifactSourceRow;
  const r2 = {
    id: 'arg-q', debateId: 'd2', debateTitle: 'Second structural title',
    authorId: 'u2', body: 'Second structural claim body.',
    createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z',
    inactiveAt: null,
    inactiveReason: 'harassment',
    inactive_reason: 'abuse',
  } as unknown as ArtifactSourceRow;
  return [r1, r2];
}

describe('argumentArtifact ban-list — no verdict / truth / popularity tokens', () => {
  it('every rendered artifact string is free of banned verdict tokens', () => {
    const artifacts = groupArgumentsIntoArtifacts(poisonedRows());
    for (const a of artifacts) {
      for (const s of renderArtifactBadgeStrings(a)) {
        const lower = s.toLowerCase();
        for (const banned of BANNED_VERDICT_TOKENS) {
          expect(lower).not.toContain(banned);
        }
      }
    }
  });
});

describe('argumentArtifact non-exposure — inactiveReason NEVER surfaces (§10a)', () => {
  it('neither the `inactiveReason`/`inactive_reason` KEY nor its VALUES appear in the serialized output', () => {
    const artifacts = groupArgumentsIntoArtifacts(poisonedRows());
    const serialized = JSON.stringify(artifacts);
    // Key names absent.
    expect(serialized).not.toContain('inactiveReason');
    expect(serialized).not.toContain('inactive_reason');
    // Poisoned reason VALUES absent.
    for (const value of ['policy_violation', 'spam', 'harassment', 'abuse']) {
      expect(serialized).not.toContain(value);
    }
  });

  it('isInactive is still correctly derived from inactiveAt despite the poisoned reason fields', () => {
    const artifacts = groupArgumentsIntoArtifacts(poisonedRows());
    const inactive = artifacts.find((a) => a.isInactive);
    // The row with a non-null inactiveAt drives an inactive artifact.
    expect(inactive).toBeDefined();
  });
});
