/**
 * ADMIN-ARGS-CANONICAL-001 — AdminArgumentsTab canonical-grouping wiring tests.
 *
 * Following the existing adminArguments.test.ts / AdminArgumentsTab.inactive
 * precedent, we test the source-file shape (no native renderer in CI). The
 * assertions verify: the tab groups filtered rows into artifacts via
 * `groupArgumentsIntoArtifacts`; renders the structural badges ("N updates",
 * observation coverage, "N duplicate runs collapsed"); renders a
 * show-update-history expansion; drives the inactive badge from the artifact
 * (never `inactiveReason`); preserves the per-row deep-link route
 * (`onOpenArgumentTimeline(r.debateId, r.id)`); is backward-compatible
 * (NULL inactiveAt ⇒ active); and adds no mutation handler beyond the ones the
 * inactive card already shipped.
 *
 * Companion pure-model coverage lives in argumentArtifactModel.test.ts and
 * argumentArtifactBanList.test.ts.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = process.cwd();
const src = fs.readFileSync(
  path.join(repoRoot, 'src/features/admin/AdminArgumentsTab.tsx'),
  'utf8',
);

describe('AdminArgumentsTab — canonical artifact grouping', () => {
  it('imports and calls groupArgumentsIntoArtifacts over the filtered rows', () => {
    expect(src).toContain("from '../arguments/argumentArtifactModel'");
    expect(src).toContain('groupArgumentsIntoArtifacts(sourceRows)');
  });

  it('iterates artifactRows (one row per logical argument), not raw rows', () => {
    expect(src).toMatch(/artifactRows\.map\(\(\{\s*artifact,\s*primaryRow:\s*r\s*\}\)\s*=>/);
  });

  it('uses the artifactId as the React key (stable per logical argument)', () => {
    expect(src).toContain('key={artifact.artifactId}');
  });
});

describe('AdminArgumentsTab — structural artifact badges', () => {
  it('renders an "N updates" badge from artifact.updateCount', () => {
    expect(src).toMatch(/\$\{artifact\.updateCount\}\s*updates/);
  });

  it('renders observation coverage as "x/y observations" or "n/a" — never fabricated', () => {
    expect(src).toContain('observations n/a');
    expect(src).toMatch(/artifact\.observationCount\.covered\}\/\$\{artifact\.observationCount\.total\}\s*observations/);
  });

  it('renders a "N duplicate runs collapsed" badge from artifact.duplicateRunCount', () => {
    expect(src).toMatch(/\$\{artifact\.duplicateRunCount\}\s*duplicate runs collapsed/);
  });

  it('exposes the structural-badge cluster testID', () => {
    expect(src).toContain('admin-arguments-artifact-badges-${r.id}');
  });
});

describe('AdminArgumentsTab — show-update-history expansion', () => {
  it('renders a history toggle only when an artifact has more than one revision', () => {
    expect(src).toMatch(/artifact\.revisions\.length\s*>\s*1\s*&&/);
    expect(src).toContain('admin-arguments-history-toggle-${r.id}');
  });

  it('toggles expansion via the toggleArtifactExpanded callback', () => {
    expect(src).toContain('const toggleArtifactExpanded = useCallback');
    expect(src).toMatch(/onPress=\{\(\)\s*=>\s*toggleArtifactExpanded\(artifact\.artifactId\)\}/);
  });

  it('lists revisions when expanded with an accessible history testID', () => {
    expect(src).toContain('admin-arguments-history-${r.id}');
    expect(src).toMatch(/artifact\.revisions\.map\(/);
  });

  it('the expansion label is plain-language Show / Hide update history', () => {
    expect(src).toContain('Show update history');
    expect(src).toContain('Hide update history');
  });
});

describe('AdminArgumentsTab — inactive badge from the artifact, NOT the reason', () => {
  it('OR-folds isInactive from artifact.isInactive (no-resurrect)', () => {
    expect(src).toMatch(/const isInactive = artifact\.isInactive \|\| r\.inactiveAt !== null/);
  });

  it('NEVER reads the inactiveReason field on the row (matches the leakage-scan convention)', () => {
    // The §10a guarantee is "never read the reason into the render path."
    // The existing argumentInactiveLeakageScan pins `r.inactiveReason` absence;
    // we mirror that here. (Doctrine-documenting comments may name the field;
    // the load-bearing rule is no member-access read into a rendered node.)
    expect(src).not.toMatch(/r\.inactiveReason/);
    expect(src).not.toMatch(/artifact\.inactiveReason/);
    expect(src).not.toMatch(/\binactiveReason\s*[:=]/);
  });

  it('still renders the Inactive / Active chip and the inactiveAt timestamp', () => {
    expect(src).toMatch(/label="Inactive"/);
    expect(src).toMatch(/label="Active"/);
    expect(src).toMatch(/formatRelativeShort\(r\.inactiveAt!\)/);
  });
});

describe('AdminArgumentsTab — deep-link route preserved (design §13 Q4)', () => {
  it('the Open timeline affordance still routes by (debateId, argument id)', () => {
    // artifactId IS the argument id for the option-a primary key, so the
    // route key is unchanged.
    expect(src).toMatch(/onOpenArgumentTimeline\(r\.debateId,\s*r\.id\)/);
  });
});

describe('AdminArgumentsTab — backward compatibility + no new mutation', () => {
  it('absent / NULL inactiveAt maps to active via the model (no crash path)', () => {
    // The tab maps row.inactiveAt straight into the source row; the model
    // derives isInactive from inactiveAt only (NULL ⇒ active).
    expect(src).toMatch(/inactiveAt:\s*r\.inactiveAt/);
  });

  it('does not introduce a reactivate/hard-delete/modify mutation in the grouping path', () => {
    // The grouping wiring is read-path only. The ONLY mutation wrappers are
    // the inactive-card ones already shipped (mark inactive/active). No new
    // delete / reactivate-on-group / edit handler is added by this card.
    expect(src).not.toMatch(/hardDelete|deleteArtifact|reactivateArtifact|modifyArtifact/);
  });
});
