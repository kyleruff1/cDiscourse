/**
 * Tests for `scripts/diagnostics/buildDiagnosticInspectPackage.js`.
 *
 * Pure-function coverage of the redactor, safety scanner, metrics
 * builder, semantic-values builder, manifest, and recommendations.
 * Plus a smoke test that the script runs in dry mode without throwing.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFileSync } from 'child_process';

const repoRoot = process.cwd();

const builder = require('../scripts/diagnostics/buildDiagnosticInspectPackage');

describe('safety patterns', () => {
  it('flags Anthropic API key shape', () => {
    expect(builder.scanText('sk-ant-' + 'A'.repeat(40)).length).toBeGreaterThan(0);
  });
  it('flags xAI key shape', () => {
    expect(builder.scanText('xai-' + 'A'.repeat(40)).length).toBeGreaterThan(0);
  });
  it('flags Supabase secret key shape', () => {
    expect(builder.scanText('sb_secret_' + 'A'.repeat(30)).length).toBeGreaterThan(0);
  });
  it('flags JWT shape', () => {
    expect(builder.scanText('eyJ' + 'A'.repeat(50)).length).toBeGreaterThan(0);
  });
  it('flags Bearer tokens', () => {
    expect(builder.scanText('Bearer ' + 'A'.repeat(40)).length).toBeGreaterThan(0);
  });
  it('flags Authorization header', () => {
    expect(builder.scanText('Authorization: Bearer secret-token-here').length).toBeGreaterThan(0);
  });
  it('flags @handle', () => {
    expect(builder.scanText('Look at @someuser today.').length).toBeGreaterThan(0);
  });
  it('does NOT flag scoped npm package names (pkg names, not handles)', () => {
    expect(builder.scanText('remove @testing-library/jest-native dep')).not.toContain('x_handle');
    expect(builder.scanText('bump @jest/reporters and @expo/config-plugins')).not.toContain('x_handle');
    // a real handle (no scoped-pkg slash) still flags
    expect(builder.scanText('ping @realuser please')).toContain('x_handle');
  });
  it('flags x.com URLs', () => {
    expect(builder.scanText('See https://x.com/user/status/123456789012345678').length).toBeGreaterThan(0);
  });
  it('flags t.co URLs', () => {
    expect(builder.scanText('Visit https://t.co/abc123').length).toBeGreaterThan(0);
  });
  it('flags raw post IDs', () => {
    expect(builder.scanText('Post 1234567890123456 something').length).toBeGreaterThan(0);
  });
  it('flags email-like strings', () => {
    expect(builder.scanText('Contact me at test@example.com').length).toBeGreaterThan(0);
  });
  it('returns no hits on clean prose', () => {
    expect(builder.scanText('A clean run report with no identifiers and no secrets.')).toEqual([]);
  });
});

describe('sanitiseLine', () => {
  it('replaces @handles with <x-handle>', () => {
    expect(builder.sanitiseLine('Posted by @someone')).toContain('<x-handle>');
    expect(builder.sanitiseLine('Posted by @someone')).not.toContain('@someone');
  });
  it('leaves scoped npm package names intact (pkg names, not handles)', () => {
    const out = builder.sanitiseLine('upgrade @testing-library/react-native and @jest/globals');
    expect(out).toContain('@testing-library/react-native');
    expect(out).toContain('@jest/globals');
    expect(out).not.toContain('<x-handle>');
    // a real handle is still replaced
    expect(builder.sanitiseLine('thanks @realuser')).toContain('<x-handle>');
  });
  it('replaces x.com URLs with <x-link>', () => {
    expect(builder.sanitiseLine('See https://x.com/user/status/1')).toContain('<x-link>');
  });
  it('replaces emails with <email>', () => {
    expect(builder.sanitiseLine('contact: bot@test.com')).toContain('<email>');
  });
  it('replaces Bearer tokens', () => {
    expect(builder.sanitiseLine('Authorization: Bearer abcdefghijklmnop')).toContain('[redacted]');
  });
  it('replaces sk-ant- key shapes', () => {
    expect(builder.sanitiseLine('key: sk-ant-' + 'A'.repeat(30))).toContain('[redacted-sk-ant]');
  });
});

describe('buildCorpusMetrics', () => {
  let tmpDir: string;
  let jsonlPath: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-test-'));
    jsonlPath = path.join(tmpDir, 'sample.jsonl');
    const events = [
      { stage: 'run_start', runId: 'r1' },
      { stage: 'skill_validation', runId: 'r1' },
      { stage: 'source_harvest', runId: 'r1', sourceHash: 's1' },
      { stage: 'source_harvest', runId: 'r1', sourceHash: 's2' },
      { stage: 'dissent_detection', runId: 'r1', classification: { usableForBotDebate: true } },
      { stage: 'dissent_detection', runId: 'r1', classification: { usableForBotDebate: false } },
      { stage: 'scenario_build', runId: 'r1', scenarioId: 'sc1' },
      { stage: 'bot_assignment', runId: 'r1' },
      { stage: 'move_prompt_built', runId: 'r1' },
      { stage: 'move_rendered', runId: 'r1' },
      { stage: 'move_validated', runId: 'r1' },
      { stage: 'bot_move_render', runId: 'r1', move: { disagreementAxis: 'evidence' }, generationSpec: { chosenAxis: 'evidence', mechanism: 'primary source', jsonParsed: true, fallbackAxisUsed: false } },
      { stage: 'submit_attempt', runId: 'r1', attempted: true },
      { stage: 'submit_result', runId: 'r1', status: 'posted' },
      { stage: 'bot_move_render', runId: 'r1', move: { disagreementAxis: 'scope' }, generationSpec: { chosenAxis: 'scope', jsonParsed: false, fallbackAxisUsed: true } },
      { stage: 'submit_attempt', runId: 'r1', attempted: true },
      { stage: 'submit_result', runId: 'r1', status: 'rejected', httpStatus: 422, errorCode: 'validation_failed', detail: 'topic_satisfaction_lexical' },
      { stage: 'annotation', runId: 'r1', annotationSource: 'deterministic_fallback' },
      { stage: 'room_summary', runId: 'r1', stopReason: 'max_depth_reached' },
      { stage: 'run_summary', runId: 'r1' },
    ];
    fs.writeFileSync(jsonlPath, events.map((e) => JSON.stringify(e)).join('\n'));
  });

  afterAll(() => {
    try { fs.unlinkSync(jsonlPath); fs.rmdirSync(tmpDir); } catch { /* swallow */ }
  });

  it('counts sources, dissent, scenarios, rooms', () => {
    const m = builder.buildCorpusMetrics([jsonlPath]);
    expect(m.totalSources).toBe(2);
    expect(m.usableDissent).toBe(1);
    expect(m.scenarios).toBe(1);
    expect(m.rooms).toBe(1);
  });

  it('counts moves attempted / posted / rejected', () => {
    const m = builder.buildCorpusMetrics([jsonlPath]);
    expect(m.movesAttempted).toBe(2);
    expect(m.movesPosted).toBe(1);
    expect(m.movesRejected).toBe(1);
  });

  it('records the chosen-axis histogram', () => {
    const m = builder.buildCorpusMetrics([jsonlPath]);
    expect(m.topChosenAxis.evidence).toBe(1);
    expect(m.topChosenAxis.scope).toBe(1);
  });

  it('records validation failure + submit rejection reasons', () => {
    const m = builder.buildCorpusMetrics([jsonlPath]);
    expect(Object.keys(m.submitRejectionReasons).join(',')).toContain('validation_failed');
  });

  it('flags missing event stages', () => {
    const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-test-'));
    const fp = path.join(tmp2, 'partial.jsonl');
    fs.writeFileSync(fp, JSON.stringify({ stage: 'run_start', runId: 'partial' }) + '\n');
    const m = builder.buildCorpusMetrics([fp]);
    expect(Object.keys(m.missingEventStages).length).toBe(1);
    expect(m.missingEventStages.partial.length).toBeGreaterThan(5);
    try { fs.unlinkSync(fp); fs.rmdirSync(tmp2); } catch { /* swallow */ }
  });

  it('returns an empty default shape on no events', () => {
    const m = builder.buildCorpusMetrics([]);
    expect(m.totalSources).toBe(0);
    expect(m.runIds).toEqual([]);
  });
});

describe('buildCorpusEventIndex', () => {
  it('returns per-file event histograms keyed by relative path', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-test-'));
    const fp = path.join(tmpDir, 'sample.jsonl');
    fs.writeFileSync(fp, [{ stage: 'run_start', runId: 'r2' }, { stage: 'run_summary', runId: 'r2' }].map((e) => JSON.stringify(e)).join('\n'));
    const idx = builder.buildCorpusEventIndex([fp]);
    const key = Object.keys(idx)[0];
    expect(idx[key].runId).toBe('r2');
    expect(idx[key].byStage.run_start).toBe(1);
    expect(idx[key].byStage.run_summary).toBe(1);
    try { fs.unlinkSync(fp); fs.rmdirSync(tmpDir); } catch { /* swallow */ }
  });
});

describe('buildSemanticValues', () => {
  it('counts issue frames + amplification risks from classification fields', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-test-'));
    const fp = path.join(tmpDir, 'semantic.jsonl');
    const events = [
      { stage: 'dissent_detection', classification: { politicalIssueFrame: 'tech-platforms', amplificationRisk: 'high', disagreementType: 'scope', primaryStance: 'weak_disagree', abuseRisk: 'none' } },
      { stage: 'annotation', annotation: { politicalIssueFrame: 'sports', amplificationRisk: 'low', evidentiaryRisk: 'medium' } },
    ];
    fs.writeFileSync(fp, events.map((e) => JSON.stringify(e)).join('\n'));
    const v = builder.buildSemanticValues([fp]);
    expect(v.issueFrames['tech-platforms']).toBe(1);
    expect(v.issueFrames['sports']).toBe(1);
    expect(v.amplificationRisks['high']).toBe(1);
    expect(v.disagreementTypes['scope']).toBe(1);
    expect(v.evidentiaryRisks['medium']).toBe(1);
    try { fs.unlinkSync(fp); fs.rmdirSync(tmpDir); } catch { /* swallow */ }
  });
});

describe('buildManifest', () => {
  it('walks a staging dir and produces file path + sha-256 prefix entries', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-test-staging-'));
    fs.mkdirSync(path.join(tmpDir, 'sub'));
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'alpha');
    fs.writeFileSync(path.join(tmpDir, 'sub', 'b.txt'), 'beta');
    const m = builder.buildManifest(tmpDir);
    expect(m.files.length).toBe(2);
    expect(m.files[0].path).toBe('a.txt');
    expect(m.files[1].path).toBe('sub/b.txt');
    expect(m.files[0].sha256_prefix).toMatch(/^[0-9a-f]{16}$/);
    try { fs.unlinkSync(path.join(tmpDir, 'a.txt')); fs.unlinkSync(path.join(tmpDir, 'sub/b.txt')); fs.rmdirSync(path.join(tmpDir, 'sub')); fs.rmdirSync(tmpDir); } catch { /* swallow */ }
  });
});

describe('recommendations', () => {
  it('buildGameChangeRecommendations cites top axes and rare ones', () => {
    const md = builder.buildGameChangeRecommendations({
      topChosenAxis: { source_chain: 12, evidence: 3, fact: 1 },
      mechanismCoverage: { withMechanism: 5, withoutMechanism: 4 },
      movesRejected: 0,
      submitRejectionReasons: {},
    });
    expect(md).toContain('Axis usage');
    expect(md).toContain('source_chain');
    expect(md).toContain('Rarely-chosen axes');
    expect(md).toContain('fact');
  });

  it('buildUxPlayabilityRecommendations highlights topic-satisfaction rejections', () => {
    const md = builder.buildUxPlayabilityRecommendations({
      movesRejected: 5,
      submitRejectionReasons: { 'http_422_validation_failed_topic_satisfaction_lexical': 5 },
      validationFailureReasons: {},
    });
    expect(md).toMatch(/deploy submit-argument|topic_satisfaction/i);
  });
});

describe('analysis script', () => {
  it('is valid JS (parses)', () => {
    const text = builder.buildAnalysisScript();
    expect(text).toContain('sanitized-jsonl');
    expect(() => new Function(text.replace(/process\.exit/, 'return ').replace('#!/usr/bin/env node', ''))).not.toThrow();
  });
});

describe('script smoke test — dry mode', () => {
  it('runs without throwing and produces a staging folder + safety scan', () => {
    const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-test-out-'));
    const r = execFileSync('node', [
      path.join(repoRoot, 'scripts/diagnostics/buildDiagnosticInspectPackage.js'),
      '--dry', '--out-dir', tmpOut, '--timestamp', '2026-05-17T00-00-00-000Z',
    ], { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe' });
    const stagingDir = path.join(tmpOut, '2026-05-17T00-00-00-000Z-cdiscourse-diagnostic-inspect');
    expect(fs.existsSync(stagingDir)).toBe(true);
    expect(fs.existsSync(path.join(stagingDir, 'README.md'))).toBe(true);
    expect(fs.existsSync(path.join(stagingDir, 'MANIFEST.json'))).toBe(true);
    expect(fs.existsSync(path.join(stagingDir, 'corpus-event-index.json'))).toBe(true);
    expect(fs.existsSync(path.join(stagingDir, 'corpus-metrics.json'))).toBe(true);
    expect(fs.existsSync(path.join(stagingDir, 'semantic-values.json'))).toBe(true);
    expect(fs.existsSync(path.join(stagingDir, 'safety-scan', 'scan-summary.json'))).toBe(true);
    // Should not have produced a ZIP (dry mode).
    expect(fs.existsSync(path.join(tmpOut, '2026-05-17T00-00-00-000Z-cdiscourse-diagnostic-inspect.zip'))).toBe(false);
    // Should not have produced FAILED_SAFETY_SCAN (the project's own data is sanitised).
    expect(fs.existsSync(path.join(stagingDir, 'FAILED_SAFETY_SCAN.txt'))).toBe(false);
    // Cleanup: recursive rm.
    const rm = (p: string) => {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        for (const e of fs.readdirSync(p)) rm(path.join(p, e));
        fs.rmdirSync(p);
      } else {
        fs.unlinkSync(p);
      }
    };
    try { rm(tmpOut); } catch { /* swallow */ }
    expect(r).toBeTruthy();
  }, 60000);
});
