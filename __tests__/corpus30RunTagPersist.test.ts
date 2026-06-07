/**
 * CORPUS-30-RUNTAG-PERSIST (issue #476) — tests.
 *
 * Two surfaces:
 *   1. Migration-shape textual scan of
 *      supabase/migrations/20260605000001_corpus30_runtag_persist.sql.
 *      The migration MUST be strictly additive: one nullable column + one
 *      partial index on public.debates, no destructive DDL, no edit to a
 *      prior migration, and the title-embedded run tag is NOT removed.
 *   2. Runner wiring — the AI-driven corpus runner builds a parseable run_tag
 *      and embeds the identical tag in the room title (back-compat), so the
 *      operator backfill recipe can parse legacy titles into the new column.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '..');
const MIGRATIONS_DIR = join(repoRoot, 'supabase', 'migrations');
const MIGRATION_FILE = '20260605000001_corpus30_runtag_persist.sql';
const MIGRATION_PATH = join(MIGRATIONS_DIR, MIGRATION_FILE);

const orchestrator = require(join(repoRoot, 'scripts/bot-fixtures/runAiDrivenCorpus.js'));

let migrationText = '';

beforeAll(() => {
  migrationText = readFileSync(MIGRATION_PATH, 'utf8');
});

describe('CORPUS-30-RUNTAG-PERSIST — migration file basics', () => {
  it('exists with non-empty content', () => {
    expect(migrationText.length).toBeGreaterThan(0);
  });

  it('references the card code in its header', () => {
    expect(migrationText).toContain('CORPUS-30-RUNTAG-PERSIST');
  });

  it('exists, sequenced after its predecessor (no global-newest coupling) — sequential timestamp', () => {
    const sqlFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    expect(sqlFiles).toContain(MIGRATION_FILE);
    const idx = sqlFiles.indexOf(MIGRATION_FILE);
    expect(idx).toBeGreaterThan(0);
    // Ordered after its OWN predecessor; NOT coupled to being the global
    // newest, so a later card migration never breaks this sibling test.
    expect(sqlFiles[idx - 1] < MIGRATION_FILE).toBe(true);
  });
});

describe('CORPUS-30-RUNTAG-PERSIST — additive only, no destructive DDL', () => {
  it('adds run_tag as a nullable text column with no DEFAULT', () => {
    expect(migrationText).toMatch(/ADD\s+COLUMN\s+run_tag\s+text\s+NULL/i);
    // No DEFAULT on the new column (NULL is the implicit, intended default).
    expect(migrationText).not.toMatch(/run_tag\s+text[^,\n;]*DEFAULT/i);
    // No NOT NULL — the column must be nullable for normal/legacy rooms.
    expect(migrationText).not.toMatch(/run_tag\s+text\s+NOT\s+NULL/i);
  });

  it('creates debates_run_tag_partial_idx as a partial index on run_tag IS NOT NULL', () => {
    expect(migrationText).toMatch(/CREATE\s+INDEX\s+debates_run_tag_partial_idx/i);
    expect(migrationText).toMatch(
      /debates_run_tag_partial_idx[\s\S]{0,200}WHERE\s+run_tag\s+IS\s+NOT\s+NULL/i,
    );
  });

  it('contains no DROP TABLE / DROP COLUMN / DROP CONSTRAINT statement', () => {
    expect(migrationText).not.toMatch(/DROP\s+TABLE/i);
    expect(migrationText).not.toMatch(/ALTER\s+TABLE\s+public\.debates\s+DROP\s+COLUMN/i);
    expect(migrationText).not.toMatch(/DROP\s+CONSTRAINT/i);
  });

  it('does not widen / add a CHECK constraint', () => {
    expect(migrationText).not.toMatch(/\bCHECK\s*\(/i);
  });

  it('does not disable RLS', () => {
    expect(migrationText).not.toMatch(/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  });

  it('only touches public.debates (no other table mutated)', () => {
    const alterTargets = migrationText.match(/ALTER\s+TABLE\s+(\S+)/gi) || [];
    for (const stmt of alterTargets) {
      expect(stmt).toMatch(/public\.debates/i);
    }
  });

  it('does not perform an INSERT/UPDATE backfill (operator-run only)', () => {
    // The recipe is documented in a SQL comment, but no executable
    // INSERT/UPDATE statement may exist outside the comment block. We assert
    // there is no live UPDATE statement (the comment uses no terminating
    // semicolon outside the dashed comment lines).
    const withoutComments = migrationText
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');
    expect(withoutComments).not.toMatch(/UPDATE\s+public\.debates\s+SET/i);
    expect(withoutComments).not.toMatch(/INSERT\s+INTO\s+public\.debates/i);
  });

  it('documents the operator backfill recipe in a comment', () => {
    // The recipe parses the legacy title bracket into run_tag.
    expect(migrationText).toMatch(/OPERATOR\s+BACKFILL/i);
    expect(migrationText).toMatch(/substring\s*\(\s*title/i);
  });
});

describe('CORPUS-30-RUNTAG-PERSIST — prior migrations untouched', () => {
  it('the immediately-preceding migration still ends at its own card (not re-edited for run_tag)', () => {
    const prior = readFileSync(
      join(MIGRATIONS_DIR, '20260604000001_admin_args_inactive_001_argument_inactive_state.sql'),
      'utf8',
    );
    // A prior migration must never mention this card's column.
    expect(prior).not.toMatch(/run_tag/i);
  });

  it('the initial schema (debates table) is not edited to add run_tag', () => {
    const initial = readFileSync(
      join(MIGRATIONS_DIR, '20260516000001_initial_schema.sql'),
      'utf8',
    );
    expect(initial).not.toMatch(/run_tag/i);
  });
});

describe('CORPUS-30-RUNTAG-PERSIST — runner builds a parseable run_tag', () => {
  it('buildRunTag produces the documented "ai-corpus <runId8> #<scenarioId>" format', () => {
    const runId = '2026abcd-ffff-0000-1111-222233334444';
    const tag = orchestrator.buildRunTag(runId, 'ai-foo-12-345678');
    expect(tag).toBe('ai-corpus 2026abcd #ai-foo-12-345678');
  });

  it('buildRunTag uses only the first 8 chars of the runId', () => {
    const tag = orchestrator.buildRunTag('0123456789-rest-of-uuid', 'sc-1');
    expect(tag).toBe('ai-corpus 01234567 #sc-1');
  });

  it('buildRoomTitle embeds the identical run_tag in the title bracket (back-compat)', () => {
    const runId = 'deadbeef-aaaa-bbbb-cccc-ddddeeeeffff';
    const scenarioId = 'ai-bar-15-987654';
    const tag = orchestrator.buildRunTag(runId, scenarioId);
    const title = orchestrator.buildRoomTitle('Should cities ban cars', runId, scenarioId);
    expect(title).toBe(`Should cities ban cars [${tag}]`);
    // The title still contains the legacy "[ai-corpus ...]" bracket so existing
    // gallery dedupe / back-compat parsing keeps working.
    expect(title).toMatch(/\[ai-corpus deadbeef #ai-bar-15-987654\]/);
  });

  it('the live debates insert wires run_tag onto the row', () => {
    const src = readFileSync(
      join(repoRoot, 'scripts/bot-fixtures/runAiDrivenCorpus.js'),
      'utf8',
    );
    // The insert into debates includes run_tag built from buildRunTag.
    expect(src).toMatch(/const\s+runTag\s*=\s*buildRunTag\(runId,\s*s\.scenarioId\)/);
    expect(src).toMatch(/\.from\('debates'\)\.insert\(\{[\s\S]{0,300}run_tag:\s*runTag/);
  });

  it('the operator backfill regex recovers run_tag from a title built by buildRoomTitle', () => {
    // This mirrors the SQL recipe: substring(title FROM '\[(ai-corpus [^\]]+)\]').
    const runId = 'cafef00d-0000';
    const scenarioId = 'ai-baz-12-111';
    const tag = orchestrator.buildRunTag(runId, scenarioId);
    const title = orchestrator.buildRoomTitle('Topic', runId, scenarioId);
    const recovered = title.match(/\[(ai-corpus [^\]]+)\]/);
    expect(recovered).not.toBeNull();
    expect(recovered && recovered[1]).toBe(tag);
  });
});
