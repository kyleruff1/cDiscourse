/**
 * OPS-MCP-SMOKE-DOCTRINE-HARDENING — Audit-lint unit + fixture self-validation.
 *
 * Tests the pure helpers in `audit-lint-lib.cjs` plus the audit-lint
 * rules data in `audit-lint-rules.cjs`. The fixture self-validation
 * suite (added in C3) is the centerpiece per intent §4.
 *
 * Source-of-truth: docs/designs/OPS-MCP-SMOKE-DOCTRINE-HARDENING.md
 */

import * as fs from 'fs';
import * as path from 'path';

interface ParseCliArgsResult {
  ok: boolean;
  options?: {
    docPath: string | null;
    reportOnly: boolean;
    help: boolean;
  };
  error?: string;
}

interface AuditPhase {
  id: string;
  rawHeader: string;
  headerLineNumber: number;
  status: 'PASS' | 'PARTIAL' | 'FAIL' | 'NOT-RUN' | null;
  statusLineNumber: number | null;
  justificationText: string;
  explicitlyOptional: boolean;
}

interface AuditDocParsed {
  title: string;
  auditType: string;
  hasMarker: boolean;
  family: string | null;
  verdict: 'PASS' | 'PARTIAL' | 'FAIL' | null;
  verdictHeaderLineNumber: number | null;
  phases: AuditPhase[];
}

interface AuditFinding {
  rule: string;
  severity: 'error' | 'warn';
  message: string;
  details: Record<string, unknown>;
  line: number | null;
}

interface LintResult {
  exitCode: 0 | 1 | 2;
  parsed: AuditDocParsed;
  findings: AuditFinding[];
}

const lib = require('../scripts/ops/audit-lint-lib.cjs') as {
  DEFAULTS: { docPath: null; reportOnly: false; help: false };
  parseCliArgs: (argv: unknown) => ParseCliArgsResult;
  helpText: () => string;
  isTemplateFilename: (p: string) => boolean;
  stripBom: (s: string) => string;
  splitLines: (s: string) => string[];
  detectAuditType: (title: string, body: string) => string;
  detectFamily: (title: string, body: string) => string | null;
  normalizePhaseId: (rawHeader: string) => string;
  parseAuditDoc: (text: string) => AuditDocParsed;
  lintAuditDoc: (text: string, options?: { reportOnly?: boolean }) => LintResult;
  formatFindingsText: (
    result: LintResult,
    options?: { docPath?: string },
  ) => string;
  rules: {
    MARKER_STRING: string;
    AUDIT_TYPE_PATTERNS: Record<string, RegExp[]>;
    DOCTRINE_RISK_FAMILIES: Set<string>;
    REQUIRED_PHASES_BY_AUDIT_TYPE: Record<string, Set<string>>;
    OPTIONAL_PHASES_BY_AUDIT_TYPE: Record<string, Set<string>>;
    DIRECT_PROOF_REQUIRED_PHASES_BY_AUDIT_TYPE: Record<string, Set<string>>;
    L2_INDIRECT_PHRASES: RegExp[];
    PRODUCTION_ENABLE_REQUIRED_ASSERTIONS: Record<string, RegExp[]>;
    L4_RESULT_ROW_EVIDENCE: RegExp[];
    L4_RUN_ROW_ONLY_LANGUAGE: RegExp[];
    L5_PERSISTED_INSPECTION_PATTERNS: RegExp[];
    L6_PRIOR_VERDICT_PATTERNS: RegExp[];
    L6_MISSING_PROOF_PATTERNS: RegExp[];
    L6_NEWLY_SUPPLIED_PROOF_PATTERNS: RegExp[];
  };
};

const {
  DEFAULTS,
  parseCliArgs,
  helpText,
  isTemplateFilename,
  stripBom,
  splitLines,
  detectAuditType,
  detectFamily,
  normalizePhaseId,
  parseAuditDoc,
  lintAuditDoc,
  formatFindingsText,
  rules,
} = lib;

const SCRIPT_PATH = path.join(
  process.cwd(),
  'scripts',
  'ops',
  'audit-lint.mjs',
);
const LIB_PATH = path.join(
  process.cwd(),
  'scripts',
  'ops',
  'audit-lint-lib.cjs',
);
const RULES_PATH = path.join(
  process.cwd(),
  'scripts',
  'ops',
  'audit-lint-rules.cjs',
);

/* ============================================================ */
/* 1. CLI argument parsing                                       */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — CLI argument parsing', () => {
  it('returns defaults when argv is empty', () => {
    const result = parseCliArgs([]);
    expect(result.ok).toBe(true);
    expect(result.options).toEqual(DEFAULTS);
  });

  it('rejects non-array argv', () => {
    const result = parseCliArgs(null);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('parses --help', () => {
    const result = parseCliArgs(['--help']);
    expect(result.ok).toBe(true);
    expect(result.options?.help).toBe(true);
  });

  it('parses -h as --help shorthand', () => {
    const result = parseCliArgs(['-h']);
    expect(result.ok).toBe(true);
    expect(result.options?.help).toBe(true);
  });

  it('parses --report-only flag', () => {
    const result = parseCliArgs(['--report-only', 'docs/audits/foo.md']);
    expect(result.ok).toBe(true);
    expect(result.options?.reportOnly).toBe(true);
    expect(result.options?.docPath).toBe('docs/audits/foo.md');
  });

  it('parses positional doc path', () => {
    const result = parseCliArgs(['docs/audits/foo.md']);
    expect(result.ok).toBe(true);
    expect(result.options?.docPath).toBe('docs/audits/foo.md');
  });

  it('rejects unknown flag', () => {
    const result = parseCliArgs(['--no-such-flag']);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('--no-such-flag');
  });

  it('rejects two positional arguments', () => {
    const result = parseCliArgs(['a.md', 'b.md']);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('positional');
  });

  it('helpText starts with the card identifier', () => {
    const h = helpText();
    expect(h).toContain('OPS-MCP-SMOKE-DOCTRINE-HARDENING');
    expect(h).toContain('USAGE:');
    expect(h).toContain('EXIT CODES:');
  });
});

/* ============================================================ */
/* 2. Template-doc refusal                                       */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — template-doc refusal', () => {
  it('isTemplateFilename matches *-template.md', () => {
    expect(isTemplateFilename('docs/audits/MCP-SERVER-005-FAMILY-D-SMOKE-template.md')).toBe(true);
  });

  it('isTemplateFilename matches mixed case', () => {
    expect(isTemplateFilename('FOO-Template.md')).toBe(true);
  });

  it('isTemplateFilename does NOT match regular smoke docs', () => {
    expect(isTemplateFilename('docs/audits/MCP-SERVER-006-FAMILY-E-SMOKE-2026-05-27.md')).toBe(false);
  });

  it('isTemplateFilename returns false for non-string', () => {
    // @ts-expect-error intentional bad input
    expect(isTemplateFilename(null)).toBe(false);
  });
});

/* ============================================================ */
/* 3. Text normalization                                         */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — text normalization', () => {
  it('stripBom removes leading UTF-8 BOM', () => {
    const bommed = '﻿hello';
    expect(stripBom(bommed)).toBe('hello');
  });

  it('stripBom returns input unchanged if no BOM', () => {
    expect(stripBom('plain')).toBe('plain');
  });

  it('stripBom tolerates non-string input', () => {
    // @ts-expect-error intentional bad input
    expect(stripBom(null)).toBe('');
  });

  it('splitLines accepts CRLF line endings', () => {
    expect(splitLines('a\r\nb\r\nc')).toEqual(['a', 'b', 'c']);
  });

  it('splitLines accepts LF line endings', () => {
    expect(splitLines('a\nb\nc')).toEqual(['a', 'b', 'c']);
  });

  it('splitLines strips BOM before splitting', () => {
    expect(splitLines('﻿a\nb')).toEqual(['a', 'b']);
  });
});

/* ============================================================ */
/* 4. Audit-type detection                                       */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — audit-type detection', () => {
  it('detects family-ship from title', () => {
    expect(
      detectAuditType(
        '# MCP-SERVER-006-FAMILY-E-SMOKE — Slippery-slope classifier audit',
        '',
      ),
    ).toBe('family-ship');
  });

  it('detects amendment from title', () => {
    expect(
      detectAuditType(
        '# MCP-SERVER-006-FAMILY-E-SMOKE-AMENDMENT — gap closure',
        '',
      ),
    ).toBe('amendment');
  });

  it('detects hosted-completion from title', () => {
    expect(
      detectAuditType(
        '# MCP-SERVER-006-FAMILY-E-SMOKE-COMPLETION-HOSTED — final upgrade',
        '',
      ),
    ).toBe('hosted-completion');
  });

  it('detects production-enable from ENABLE-SMOKE title', () => {
    expect(
      detectAuditType(
        '# MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE — production enable',
        '',
      ),
    ).toBe('production-enable');
  });

  it('detects ops from OPS- title prefix', () => {
    expect(
      detectAuditType(
        '# OPS-MCP-SMOKE-DOCTRINE-HARDENING-SMOKE — hardening smoke',
        '',
      ),
    ).toBe('ops');
  });

  it('amendment takes precedence over family-ship when both could match', () => {
    expect(
      detectAuditType(
        '# MCP-SERVER-006-FAMILY-E-SMOKE-AMENDMENT — family E amendment',
        '',
      ),
    ).toBe('amendment');
  });

  it('hosted-completion takes precedence over family-ship when both could match', () => {
    expect(
      detectAuditType(
        '# MCP-SERVER-006-FAMILY-E-SMOKE-COMPLETION-HOSTED — family E completion',
        '',
      ),
    ).toBe('hosted-completion');
  });

  it('body-level Audit-type override wins', () => {
    expect(
      detectAuditType(
        '# random title',
        'Audit-type: ops\n\nsome body',
      ),
    ).toBe('ops');
  });

  it('returns unknown when no pattern matches', () => {
    expect(detectAuditType('# completely unrelated doc', '')).toBe('unknown');
  });
});

/* ============================================================ */
/* 5. Family detection                                           */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — family detection', () => {
  it('detects argument_scheme from body mention', () => {
    expect(detectFamily('# foo', 'argument_scheme classifier')).toBe(
      'argument_scheme',
    );
  });

  it('detects argument_scheme from slippery_slope alias', () => {
    expect(detectFamily('# foo', 'slippery_slope rule fires')).toBe(
      'argument_scheme',
    );
  });

  it('detects family letter from title', () => {
    expect(detectFamily('MCP-SERVER-006-FAMILY-E-SMOKE', '')).toBe(
      'family_e',
    );
  });

  it('body-level Family declaration wins', () => {
    expect(
      detectFamily('# foo', 'Family: argument_scheme\n\nbody'),
    ).toBe('argument_scheme');
  });

  it('returns null when nothing detectable', () => {
    expect(detectFamily('# unrelated', 'just words')).toBeNull();
  });
});

/* ============================================================ */
/* 6. Phase-id normalization                                     */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — phase-id normalization', () => {
  it('normalizes Phase 3 hosted MCP smoke header', () => {
    expect(
      normalizePhaseId('## Phase 3 — Hosted MCP server smoke (15 checks)'),
    ).toBe('phase-3-hosted-mcp-smoke');
  });

  it('normalizes Phase 1 — Pre-flight', () => {
    expect(normalizePhaseId('## Phase 1 — Pre-flight')).toBe('phase-1-preflight');
  });

  it('normalizes Phase 4 — Edge admin_validation', () => {
    expect(
      normalizePhaseId('## Phase 4 — Edge admin_validation'),
    ).toBe('phase-4-edge-admin-validation');
  });

  it('normalizes Amendment §5 — Read-path readback (preserves tail when not in canonical set)', () => {
    expect(
      normalizePhaseId('## Amendment §5 — Read-path readback'),
    ).toBe('amendment-5-read-path-readback');
  });

  it('normalizes Phase 2 local Deno regression', () => {
    expect(
      normalizePhaseId('## Phase 2 — Local Deno regression'),
    ).toBe('phase-2-local-regression');
  });

  it('returns empty string for non-string input', () => {
    // @ts-expect-error intentional bad input
    expect(normalizePhaseId(null)).toBe('');
  });
});

/* ============================================================ */
/* 7. parseAuditDoc                                              */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — parseAuditDoc', () => {
  it('extracts title from line 1', () => {
    const doc = '# MCP-SERVER-006-FAMILY-E-SMOKE — body\n\nfoo';
    const parsed = parseAuditDoc(doc);
    expect(parsed.title).toBe('MCP-SERVER-006-FAMILY-E-SMOKE — body');
  });

  it('detects audit type', () => {
    const doc = '# MCP-SERVER-006-FAMILY-E-SMOKE — body';
    expect(parseAuditDoc(doc).auditType).toBe('family-ship');
  });

  it('detects marker presence', () => {
    const docWith = '# x\n\nAudit-Lint: v1\n\nbody';
    const docWithout = '# x\n\nbody';
    expect(parseAuditDoc(docWith).hasMarker).toBe(true);
    expect(parseAuditDoc(docWithout).hasMarker).toBe(false);
  });

  it('extracts verdict tag from `## Verdict` + `**PASS**` on next line', () => {
    const doc = [
      '# foo',
      '',
      '## Verdict',
      '',
      '**PASS** — all good',
    ].join('\n');
    const parsed = parseAuditDoc(doc);
    expect(parsed.verdict).toBe('PASS');
  });

  it('extracts verdict tag from `## Verdict (amended)` form', () => {
    const doc = [
      '# foo',
      '',
      '## Verdict (amended)',
      '',
      '**PARTIAL** — capped per R2',
    ].join('\n');
    const parsed = parseAuditDoc(doc);
    expect(parsed.verdict).toBe('PARTIAL');
  });

  it('extracts verdict tag from `## Final upgraded verdict` form', () => {
    const doc = [
      '# foo',
      '',
      '## Final upgraded verdict',
      '',
      '**PASS** — gap 1 closed',
    ].join('\n');
    const parsed = parseAuditDoc(doc);
    expect(parsed.verdict).toBe('PASS');
  });

  it('extracts verdict tag from `### Final verdict` form', () => {
    const doc = [
      '# foo',
      '',
      '### Final verdict',
      '',
      '**FAIL** — broken',
    ].join('\n');
    const parsed = parseAuditDoc(doc);
    expect(parsed.verdict).toBe('FAIL');
  });

  it('takes LAST verdict header when multiple present', () => {
    const doc = [
      '# foo',
      '',
      '## Verdict',
      '',
      '**PARTIAL** — original',
      '',
      '## Final amended verdict',
      '',
      '**PASS** — amended later',
    ].join('\n');
    const parsed = parseAuditDoc(doc);
    expect(parsed.verdict).toBe('PASS');
  });

  it('extracts phases with statuses', () => {
    const doc = [
      '# MCP-SERVER-006-FAMILY-E-SMOKE — body',
      '',
      '## Phase 1 — Pre-flight',
      '',
      '**Status:** PASS',
      '',
      '## Phase 3 — Hosted MCP server smoke',
      '',
      '**Status:** NOT-RUN',
      '',
      'Justified by Phase 4.',
      '',
      '## Verdict',
      '',
      '**PASS** — all good',
    ].join('\n');
    const parsed = parseAuditDoc(doc);
    expect(parsed.phases).toHaveLength(2);
    expect(parsed.phases[0].id).toBe('phase-1-preflight');
    expect(parsed.phases[0].status).toBe('PASS');
    expect(parsed.phases[1].id).toBe('phase-3-hosted-mcp-smoke');
    expect(parsed.phases[1].status).toBe('NOT-RUN');
    expect(parsed.phases[1].justificationText).toContain('Justified by Phase 4');
  });

  it('marks phase as explicitly optional when (optional) present', () => {
    const doc = [
      '# MCP-SERVER-006-FAMILY-E-SMOKE — body',
      '',
      '## Phase 7 — OPS observations (optional)',
      '',
      '**Status:** NOT-RUN',
    ].join('\n');
    const parsed = parseAuditDoc(doc);
    expect(parsed.phases[0].explicitlyOptional).toBe(true);
  });

  it('tolerates CRLF line endings', () => {
    const doc = '# foo\r\n\r\n## Phase 1 — Pre-flight\r\n\r\n**Status:** PASS\r\n';
    const parsed = parseAuditDoc(doc);
    expect(parsed.phases).toHaveLength(1);
    expect(parsed.phases[0].status).toBe('PASS');
  });

  it('tolerates leading BOM', () => {
    const doc = '﻿# foo\n\n## Verdict\n\n**PASS**';
    const parsed = parseAuditDoc(doc);
    expect(parsed.title).toBe('foo');
    expect(parsed.verdict).toBe('PASS');
  });

  it('ignores verdict-tag inside a code block', () => {
    const doc = [
      '# foo',
      '',
      '```',
      '## Verdict',
      '**PASS**',
      '```',
      '',
      '## Verdict',
      '',
      '**FAIL** — actual',
    ].join('\n');
    const parsed = parseAuditDoc(doc);
    expect(parsed.verdict).toBe('FAIL');
  });
});

/* ============================================================ */
/* 8. lintAuditDoc — C2 stub returns no findings (rules in C3)  */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — lintAuditDoc C2 stub', () => {
  it('returns exit 0 + no findings for a normal doc (rules land in C3)', () => {
    const doc = [
      '# MCP-SERVER-006-FAMILY-E-SMOKE — body',
      '',
      '## Phase 1 — Pre-flight',
      '',
      '**Status:** PASS',
      '',
      '## Verdict',
      '',
      '**PASS** — ok',
    ].join('\n');
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it('returns exit 2 + parse finding for malformed doc', () => {
    const result = lintAuditDoc('');
    expect(result.exitCode).toBe(2);
    expect(result.findings[0]?.rule).toBe('parse');
  });
});

/* ============================================================ */
/* 9. formatFindingsText                                         */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — formatFindingsText', () => {
  it('renders zero-findings result as "0 (PASS)"', () => {
    const result: LintResult = {
      exitCode: 0,
      parsed: {
        title: 'foo',
        auditType: 'family-ship',
        hasMarker: false,
        family: null,
        verdict: 'PASS',
        verdictHeaderLineNumber: 5,
        phases: [],
      },
      findings: [],
    };
    const text = formatFindingsText(result, { docPath: 'docs/x.md' });
    expect(text).toContain('docs/x.md');
    expect(text).toContain('audit-type:  family-ship');
    expect(text).toContain('0 (PASS)');
  });

  it('renders findings with the rule id prefix', () => {
    const result: LintResult = {
      exitCode: 1,
      parsed: {
        title: 'foo',
        auditType: 'family-ship',
        hasMarker: false,
        family: null,
        verdict: 'PASS',
        verdictHeaderLineNumber: 5,
        phases: [],
      },
      findings: [
        {
          rule: 'L1',
          severity: 'error',
          message: 'something broken',
          details: {},
          line: 42,
        },
      ],
    };
    const text = formatFindingsText(result, {});
    expect(text).toContain('[L1]');
    expect(text).toContain('something broken');
  });
});

/* ============================================================ */
/* 10. No-fs / no-network / no-spawn in lib                      */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — pure-helper discipline', () => {
  it('lib source: contains no spawnSync references', () => {
    const src = fs.readFileSync(LIB_PATH, 'utf8');
    expect(src).not.toContain('spawnSync');
  });

  it('lib source: contains no node:child_process require', () => {
    const src = fs.readFileSync(LIB_PATH, 'utf8');
    expect(src).not.toContain('node:child_process');
  });

  it('lib source: contains no fs reads', () => {
    const src = fs.readFileSync(LIB_PATH, 'utf8');
    expect(src).not.toContain('readFileSync');
    expect(src).not.toContain('readFile(');
  });

  it('lib source: contains no fetch / http / https module imports', () => {
    const src = fs.readFileSync(LIB_PATH, 'utf8');
    expect(src).not.toContain("require('node:http')");
    expect(src).not.toContain("require('node:https')");
    expect(src).not.toContain('global.fetch');
  });

  it('rules source: contains no fs / spawn / network references', () => {
    const src = fs.readFileSync(RULES_PATH, 'utf8');
    expect(src).not.toContain('spawnSync');
    expect(src).not.toContain('node:child_process');
    expect(src).not.toContain('readFileSync');
    expect(src).not.toContain("require('node:fs')");
    expect(src).not.toContain("require('node:http')");
    expect(src).not.toContain("require('node:https')");
  });

  it('entry .mjs delegates to lib via createRequire', () => {
    const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
    expect(src).toContain('createRequire');
    expect(src).toContain('audit-lint-lib.cjs');
  });
});

/* ============================================================ */
/* 11. Rules-file invariants                                     */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — rules file invariants', () => {
  it('marker is exact "Audit-Lint: v1"', () => {
    expect(rules.MARKER_STRING).toBe('Audit-Lint: v1');
  });

  it('all audit-type pattern bundles are non-empty', () => {
    expect(rules.AUDIT_TYPE_PATTERNS.productionEnable.length).toBeGreaterThan(0);
    expect(rules.AUDIT_TYPE_PATTERNS.familyShip.length).toBeGreaterThan(0);
    expect(rules.AUDIT_TYPE_PATTERNS.amendment.length).toBeGreaterThan(0);
    expect(rules.AUDIT_TYPE_PATTERNS.hostedCompletion.length).toBeGreaterThan(0);
    expect(rules.AUDIT_TYPE_PATTERNS.ops.length).toBeGreaterThan(0);
  });

  it('doctrine-risk family set contains argument_scheme', () => {
    expect(rules.DOCTRINE_RISK_FAMILIES.has('argument_scheme')).toBe(true);
  });

  it('family-ship required phases include hosted-mcp-smoke', () => {
    expect(
      rules.REQUIRED_PHASES_BY_AUDIT_TYPE['family-ship'].has(
        'phase-3-hosted-mcp-smoke',
      ),
    ).toBe(true);
  });

  it('direct-proof phases for family-ship include hosted-mcp-smoke', () => {
    expect(
      rules.DIRECT_PROOF_REQUIRED_PHASES_BY_AUDIT_TYPE['family-ship'].has(
        'phase-3-hosted-mcp-smoke',
      ),
    ).toBe(true);
  });

  it('L2 indirect phrases include "covered indirectly"', () => {
    expect(
      rules.L2_INDIRECT_PHRASES.some((re) => re.test('Phase 3 covered indirectly via Phase 4')),
    ).toBe(true);
  });

  it('production-enable required assertions have three keys', () => {
    expect(Object.keys(rules.PRODUCTION_ENABLE_REQUIRED_ASSERTIONS).sort()).toEqual([
      'dispatch',
      'readPath',
      'targetedSignal',
    ]);
  });
});
