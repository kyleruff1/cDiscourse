/**
 * Stage 6.1.5.1 — runAiDrivenCorpus annotation wiring tests.
 *
 *  - parseArgs honors --annotate, --annotation-only, --annotation-jsonl,
 *    --deep, --report-name, --max-moves-per-room, --min-moves-per-room
 *  - annotateRoomMoves returns one annotation per move; userReviewRequired
 *    is true on every annotation
 *  - the runner file does NOT bypass submit-argument or use service-role
 *    keys, and never inserts directly into the `arguments` table
 *  - the runner file does NOT contain an Authorization header literal
 *  - the runner file routes Anthropic through claudeMessagesClient
 */
import * as fs from 'fs';
import * as path from 'path';

const runner = require('../scripts/bot-fixtures/runAiDrivenCorpus');

describe('parseArgs — annotation flags', () => {
  it('respects --annotate', () => {
    const a = runner.parseArgs(['node', 'x', '--annotate']);
    expect(a.annotate).toBe(true);
  });
  it('--annotation-only implies --annotate', () => {
    const a = runner.parseArgs(['node', 'x', '--annotation-only']);
    expect(a.annotationOnly).toBe(true);
    expect(a.annotate).toBe(true);
  });
  it('captures --annotation-jsonl <path>', () => {
    const a = runner.parseArgs(['node', 'x', '--annotation-jsonl', 'logs/foo.jsonl']);
    expect(a.annotationJsonl).toBe('logs/foo.jsonl');
  });
  it('respects --deep and --report-name and move-per-room bounds', () => {
    const a = runner.parseArgs(['node', 'x', '--deep', '--report-name', 'pilot3', '--max-moves-per-room', '20', '--min-moves-per-room', '12']);
    expect(a.deep).toBe(true);
    expect(a.reportName).toBe('pilot3');
    expect(a.maxMovesPerRoom).toBe(20);
    expect(a.minMovesPerRoom).toBe(12);
  });
});

describe('annotateRoomMoves — wiring', () => {
  it('returns one annotation per move with userReviewRequired:true', async () => {
    const scenario = {
      scenarioId: 'scen-1', roomId: 'room-1', resolution: 'Resolved: X.',
      moves: [
        { moveId: 'm1', argumentType: 'thesis', authorAlias: 'Alex', side: 'aff', body: 'X is broadly the case.' },
        { moveId: 'm2', argumentType: 'rebuttal', authorAlias: 'Jordan', side: 'neg', parentMoveId: 'm1', body: 'Source? Where is this from?', disagreementAxis: 'evidence' },
      ],
    };
    const annotated = await runner.annotateRoomMoves({ scenario, roomId: 'room-1', client: null, results: [{ moveId: 'm1', actualStatus: 'posted' }, { moveId: 'm2', actualStatus: 'failed_422', errorCode: 'invalid' }] });
    expect(annotated.length).toBe(2);
    for (const am of annotated) {
      expect(am.annotation.userReviewRequired).toBe(true);
      expect(am.annotation.schemaVersion).toBe(1);
      expect(am.annotation.annotationSource).toBe('deterministic_fallback');
    }
    expect(annotated[0].submitStatus).toBe('posted');
    expect(annotated[1].submitStatus).toBe('failed_422');
    expect(annotated[1].submitErrorCode).toBe('invalid');
  });
});

describe('runner source — file-level safety contract', () => {
  const repoRoot = process.cwd();
  const runnerPath = path.join(repoRoot, 'scripts/bot-fixtures/runAiDrivenCorpus.js');
  const src = fs.readFileSync(runnerPath, 'utf8');

  it('routes Anthropic through the shared claudeMessagesClient', () => {
    expect(src).toMatch(/require\(['"]\.\/claudeMessagesClient['"]\)/);
    expect(src).not.toMatch(/process\.env\.ANTHROPIC_API_KEY/);
  });

  it('never inserts directly into the arguments table or bypasses submit-argument', () => {
    expect(src).toMatch(/invokeSubmitArgument/);
    expect(src).not.toMatch(/\.from\(['"]arguments['"]\)\s*\.insert/);
  });

  it('never references service-role keys or service-role auth headers', () => {
    expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    expect(src).not.toMatch(/serviceRoleKey/);
    expect(src).not.toMatch(/sb_secret_[A-Za-z0-9]/);
  });

  it('does not contain a hardcoded Authorization header literal', () => {
    expect(src).not.toMatch(/Authorization:\s*['"][Bb]earer/);
    expect(src).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{16,}/);
  });

  it('writes annotation JSONL only under logs/ (gitignored) by default', () => {
    expect(src).toMatch(/LOG_DIR/);
    expect(src).toMatch(/gitignored — do not commit/);
  });
});
