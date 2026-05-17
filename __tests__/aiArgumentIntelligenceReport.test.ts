/**
 * Stage 6.1.5.1 — AI argument-intelligence report safety + shape tests.
 *
 * Verifies the annotated report contains:
 *  - full per-room transcript with parent excerpts and labels
 *  - aggregate distributions
 *  - rule-candidate table
 *  - safety markers (userReviewRequired, no verdict tokens, no secrets)
 *  - it never echoes Authorization / API key / JWT-shape strings
 */
import * as fs from 'fs';
import * as path from 'path';

const det = require('../scripts/bot-fixtures/deterministicArgumentAnnotator');
const report = require('../scripts/bot-fixtures/aiArgumentIntelligenceReport');

function detVector(over: Partial<Record<string, unknown>> = {}) {
  return {
    agreementScore: 0, disagreementScore: 0, coexistenceScore: 0, uncertaintyScore: 0.2,
    primaryStance: 'unclear', agreementType: 'none', disagreementType: 'none',
    replyFunction: 'unclear', scalarRationale: '', userReviewRequired: true, ...over,
  };
}

function makeAnnotatedRoom(roomTitle: string, scenarioId: string) {
  const moves = [
    { moveId: 'm1', argumentType: 'thesis', authorAlias: 'Alex', side: 'aff', body: 'X is broadly the case.' },
    { moveId: 'm2', argumentType: 'rebuttal', authorAlias: 'Jordan', side: 'neg', parentMoveId: 'm1', body: 'Source? Where is this from?', disagreementAxis: 'evidence' },
    { moveId: 'm3', argumentType: 'evidence', authorAlias: 'Alex', side: 'aff', parentMoveId: 'm2', body: 'Here is a concrete receipt: report ABC table 2.' },
  ];
  const annotatedMoves = moves.map((m, idx) => {
    const parent = m.parentMoveId ? moves.find((mm) => mm.moveId === m.parentMoveId) : null;
    return {
      move: m,
      parentMove: parent ? { moveId: parent.moveId, argumentType: parent.argumentType, body: parent.body } : null,
      annotation: det.deterministicAnnotate({
        scenario: { scenarioId, roomId: 'room-1', resolution: roomTitle },
        move: m, parent: parent ? { moveId: parent.moveId, argumentType: parent.argumentType, body: parent.body } : null,
        thread: [], body: m.body, deterministicVector: detVector(),
      }),
      submitStatus: idx === 1 ? 'failed_422' : 'posted',
      submitErrorCode: idx === 1 ? 'invalid_argument_type' : null,
    };
  });
  return { scenarioId, roomId: 'room-1', title: roomTitle, rootClaim: roomTitle, resolution: roomTitle, annotatedMoves };
}

describe('buildAnnotatedIntelligenceMarkdown — structure', () => {
  const rooms = [makeAnnotatedRoom('Resolved: X is broadly the case.', 'scen-1')];
  const md = report.buildAnnotatedIntelligenceMarkdown({
    runId: 'test-run-1', dateIso: '2026-05-17T10:00:00Z', mode: 'live', rooms,
  });

  it('includes the safety contract section with userReviewRequired language', () => {
    expect(md).toMatch(/## Safety contract/);
    expect(md).toMatch(/userReviewRequired/);
    expect(md).toMatch(/advisory/i);
  });

  it('includes aggregate distribution tables', () => {
    expect(md).toMatch(/Annotation source/);
    expect(md).toMatch(/Message category/);
    expect(md).toMatch(/Primary rhetorical archetype/);
    expect(md).toMatch(/Issue-debt axis/);
    expect(md).toMatch(/Submit error codes/);
    expect(md).toMatch(/invalid_argument_type/);
  });

  it('includes a top deterministic rule candidates section', () => {
    expect(md).toMatch(/Top deterministic rule candidates/);
  });

  it('includes per-room transcript with parent excerpt + body quoting', () => {
    expect(md).toMatch(/## Room — /);
    expect(md).toMatch(/### Move \d+/);
    expect(md).toMatch(/> X is broadly the case\./);
    expect(md).toMatch(/parent: `m1`/);
  });

  it('embeds annotation source per move and submitStatus per move', () => {
    expect(md).toMatch(/annotationSource: `deterministic_fallback`/);
    expect(md).toMatch(/submitStatus: `failed_422`/);
    expect(md).toMatch(/submitStatus: `posted`/);
  });
});

describe('buildAnnotatedIntelligenceMarkdown — no secrets, no verdicts', () => {
  it('strips emails, JWTs, sb_secret_, sk-ant- if they appear in any body', () => {
    const moves = [{
      moveId: 'm1', argumentType: 'thesis', authorAlias: 'Alex', side: 'aff',
      body: 'Contact me at user@example.com with Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig — secret sb_secret_FAKE12345',
    }];
    const annotation = det.deterministicAnnotate({
      scenario: { scenarioId: 'x', roomId: 'r', resolution: 'X.' },
      move: moves[0], parent: null, thread: [], body: moves[0].body, deterministicVector: detVector(),
    });
    const rooms = [{
      scenarioId: 'x', roomId: 'r', title: 'X.', rootClaim: 'X.', resolution: 'X.',
      annotatedMoves: [{ move: moves[0], parentMove: null, annotation, submitStatus: 'posted', submitErrorCode: null }],
    }];
    const md = report.buildAnnotatedIntelligenceMarkdown({ runId: 't', dateIso: '2026-05-17T00:00:00Z', mode: 'live', rooms });
    expect(md).not.toMatch(/user@example\.com/);
    expect(md).not.toMatch(/eyJhbGciOiJIUzI1NiJ9/);
    expect(md).not.toMatch(/sb_secret_FAKE/);
  });

  it('replaces any forbidden verdict token that leaks from input', () => {
    const moves = [{
      moveId: 'm1', argumentType: 'thesis', authorAlias: 'Alex', side: 'aff',
      body: 'You are a liar and propagandist — this is all bad faith manipulation.',
    }];
    const annotation = det.deterministicAnnotate({
      scenario: { scenarioId: 'x', roomId: 'r', resolution: 'X.' },
      move: moves[0], parent: null, thread: [], body: moves[0].body, deterministicVector: detVector(),
    });
    const rooms = [{
      scenarioId: 'x', roomId: 'r', title: 'X.', rootClaim: 'X.', resolution: 'X.',
      annotatedMoves: [{ move: moves[0], parentMove: null, annotation, submitStatus: 'posted', submitErrorCode: null }],
    }];
    const md = report.buildAnnotatedIntelligenceMarkdown({ runId: 't', dateIso: '2026-05-17T00:00:00Z', mode: 'live', rooms });
    expect(md.toLowerCase()).not.toContain('liar');
    expect(md.toLowerCase()).not.toContain('propagandist');
    expect(md.toLowerCase()).not.toContain('manipulation');
    expect(md.toLowerCase()).not.toContain('bad faith');
  });
});

describe('aiArgumentIntelligenceReport source — file-level safety', () => {
  const repoRoot = process.cwd();
  const srcPath = path.join(repoRoot, 'scripts/bot-fixtures/aiArgumentIntelligenceReport.js');
  const src = fs.readFileSync(srcPath, 'utf8');

  it('does not contain hardcoded API keys', () => {
    expect(src).not.toMatch(/sk-ant-[A-Za-z0-9]{8,}/);
    expect(src).not.toMatch(/sb_secret_[A-Za-z0-9]{4,}/);
  });

  it('does not log Authorization or Bearer values', () => {
    expect(src).not.toMatch(/console\.\w+\([^)]*Authorization/);
    expect(src).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{16,}/);
  });
});
