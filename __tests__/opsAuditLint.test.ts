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
    classifyChanged?: boolean;
    baseSha?: string | null;
    headSha?: string | null;
    changedListStdin?: boolean;
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

interface ChangedFileEntry {
  status: string;
  path: string;
}

const lib = require('../scripts/ops/audit-lint-lib.cjs') as {
  DEFAULTS: {
    docPath: null;
    reportOnly: false;
    help: false;
    classifyChanged: false;
    baseSha: null;
    headSha: null;
    changedListStdin: false;
  };
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
  classifyChangedFiles: (
    entries: ChangedFileEntry[],
    readMarkerAtHead: (p: string) => boolean,
  ) => string[];
  SMOKE_AUDIT_PATH_PATTERN: RegExp;
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
const WORKFLOW_PATH = path.join(
  process.cwd(),
  '.github',
  'workflows',
  'audit-lint.yml',
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

  it('AMENDMENT takes precedence over COMPLETION when both present in title', () => {
    expect(
      detectAuditType(
        '# MCP-SERVER-006-FAMILY-E-SMOKE — Amendment (smoke-completion)',
        '',
      ),
    ).toBe('amendment');
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

  it('detects Family E (argument_scheme) from title family letter', () => {
    expect(detectFamily('MCP-SERVER-006-FAMILY-E-SMOKE', '')).toBe(
      'argument_scheme',
    );
  });

  it('detects Family D (evidence_source_chain) from title family letter', () => {
    expect(detectFamily('MCP-SERVER-005-FAMILY-D-SMOKE', '')).toBe(
      'evidence_source_chain',
    );
  });

  it('detects Family D from EDGE-FAMILY-D-ENABLE title', () => {
    expect(detectFamily('MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE', '')).toBe(
      'evidence_source_chain',
    );
  });

  it('title family letter wins over body mention of argument_scheme', () => {
    // A Family D audit that mentions argument_scheme in passing (e.g.,
    // in a registry table) is still classified as evidence_source_chain.
    expect(
      detectFamily(
        'MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE',
        '- `argument_scheme` (E) — productionEnabled=false',
      ),
    ).toBe('evidence_source_chain');
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

  it('normalizes Amendment §5 — Read-path readback (canonicalizes to read-path)', () => {
    expect(
      normalizePhaseId('## Amendment §5 — Read-path readback'),
    ).toBe('amendment-5-read-path');
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
/* 8. lintAuditDoc — basic behavior                              */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — lintAuditDoc basic behavior', () => {
  it('returns exit 2 + parse finding for empty doc', () => {
    const result = lintAuditDoc('');
    expect(result.exitCode).toBe(2);
    expect(result.findings[0]?.rule).toBe('parse');
  });

  it('returns exit 0 for a well-formed Family D audit with all phases PASS', () => {
    // Use Family D so L5 (doctrine-risk) does not fire; Family E
    // would require evidence_span inspection.
    const doc = buildFamilyShipDoc({
      titleOverride: '# MCP-SERVER-005-FAMILY-D-SMOKE — synthetic test doc',
      phases: [
        ['Phase 1 — Pre-flight', 'PASS'],
        ['Phase 2 — Local Deno regression', 'PASS'],
        ['Phase 3 — Hosted MCP smoke', 'PASS'],
        ['Phase 4 — Edge admin_validation', 'PASS'],
        ['Phase 5 — Unsupported family rejection', 'PASS'],
        ['Phase 6 — Targeted regression', 'PASS'],
      ],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(0);
    expect(result.findings).toHaveLength(0);
  });
});

/* ============================================================ */
/* 9. L1 rule                                                    */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — L1 rule', () => {
  it('fires when a required phase is NOT-RUN and verdict is PASS', () => {
    const doc = buildFamilyShipDoc({
      phases: [
        ['Phase 1 — Pre-flight', 'PASS'],
        ['Phase 3 — Hosted MCP smoke', 'NOT-RUN'],
      ],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L1')).toBe(true);
  });

  it('does NOT fire when verdict is PARTIAL', () => {
    const doc = buildFamilyShipDoc({
      phases: [
        ['Phase 1 — Pre-flight', 'PASS'],
        ['Phase 3 — Hosted MCP smoke', 'NOT-RUN'],
      ],
      verdict: 'PARTIAL',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L1')).toBe(false);
  });

  it('does NOT fire when phase has (optional) marker', () => {
    const doc = buildFamilyShipDoc({
      phases: [
        ['Phase 3 — Hosted MCP smoke (optional)', 'NOT-RUN'],
      ],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L1')).toBe(false);
  });

  it('does NOT fire when amendment phase list is empty', () => {
    const doc = [
      '# MCP-SERVER-006-FAMILY-E-SMOKE-AMENDMENT — body',
      '',
      '## Phase 1 — Pre-flight',
      '',
      '**Status:** NOT-RUN',
      '',
      '## Verdict (amended)',
      '',
      '**PASS** — amended',
      '',
      'Predecessor audit: foo. Gap 1 closed; operator-supplied direct proof.',
    ].join('\n');
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L1')).toBe(false);
  });

  it('vacuously passes on no-phase doc', () => {
    const doc = [
      '# MCP-SERVER-006-FAMILY-E-SMOKE — body',
      '',
      '## Verdict',
      '',
      '**PASS** — ok',
    ].join('\n');
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L1')).toBe(false);
  });
});

/* ============================================================ */
/* 10. L2 rule                                                   */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — L2 rule', () => {
  it('fires on "covered indirectly" in NOT-RUN direct-proof phase with PASS verdict', () => {
    const doc = buildFamilyShipDoc({
      phases: [
        [
          'Phase 3 — Hosted MCP smoke',
          'NOT-RUN',
          'Phase 3 covered indirectly via Phase 4 success.',
        ],
      ],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L2')).toBe(true);
  });

  it('fires on "would pass"', () => {
    const doc = buildFamilyShipDoc({
      phases: [
        ['Phase 3 — Hosted MCP smoke', 'NOT-RUN', 'Hosted smoke would pass given Phase 4.'],
      ],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L2')).toBe(true);
  });

  it('does NOT fire when "verified via unit tests plus direct hosted smoke" is used', () => {
    const doc = buildFamilyShipDoc({
      phases: [
        [
          'Phase 3 — Hosted MCP smoke',
          'NOT-RUN',
          'Verified via unit tests plus a separate direct hosted smoke proof.',
        ],
      ],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L2')).toBe(false);
  });

  it('does NOT fire when verdict is PARTIAL', () => {
    const doc = buildFamilyShipDoc({
      phases: [
        ['Phase 3 — Hosted MCP smoke', 'NOT-RUN', 'covered indirectly via Phase 4'],
      ],
      verdict: 'PARTIAL',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L2')).toBe(false);
  });

  it('does NOT fire on phases not in direct-proof set', () => {
    const doc = buildFamilyShipDoc({
      phases: [
        ['Phase 1 — Pre-flight', 'NOT-RUN', 'covered indirectly by Phase 2'],
      ],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    // L1 will fire (Phase 1 is required) but L2 should not, because
    // Phase 1 is NOT in the direct-proof set.
    expect(result.findings.some((f) => f.rule === 'L2')).toBe(false);
  });
});

/* ============================================================ */
/* 11. L3 rule                                                   */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — L3 rule', () => {
  it('fires when production-enable audit is missing readPath assertion', () => {
    const doc = [
      '# MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE — body',
      '',
      '## Phase 1 — Pre-flight',
      '',
      '**Status:** PASS',
      '',
      'Auto-trigger fires. 4 production runs created. run_mode=production.',
      '',
      'Targeted text fired 1 positive. positive raw_keys observed.',
      '',
      '## Verdict',
      '',
      '**PASS** — ok',
    ].join('\n');
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L3')).toBe(true);
  });

  it('does NOT fire when all three assertion levels present', () => {
    const doc = [
      '# MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE — body',
      '',
      'Auto-trigger fires. 4 production runs created. run_mode=production.',
      'Targeted text fired 1 positive. positive raw_keys observed.',
      'Source 6 read-path production-only filter holds.',
      '',
      '## Verdict',
      '',
      '**PASS** — ok',
    ].join('\n');
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L3')).toBe(false);
  });

  it('does NOT fire on a family-ship audit', () => {
    const doc = buildFamilyShipDoc({
      phases: [['Phase 1 — Pre-flight', 'PASS']],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L3')).toBe(false);
  });
});

/* ============================================================ */
/* 12. L4 rule                                                   */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — L4 rule', () => {
  it('fires on run-row-only language without result-row evidence', () => {
    const doc = [
      '# MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE — body',
      '',
      'Auto-trigger fires. 4 production runs created. run_mode=production.',
      'Source 6 read-path production-only filter holds.',
      '',
      '## Phase 3 — Targeted signal',
      '',
      '**Status:** PASS',
      '',
      'Run row success. 0 positives across all 7 args.',
      '',
      '## Verdict',
      '',
      '**PASS** — ok',
    ].join('\n');
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L4')).toBe(true);
  });

  it('does NOT fire when result-row evidence is present', () => {
    const doc = [
      '# MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE — body',
      '',
      'Auto-trigger fires. 4 production runs created. run_mode=production.',
      'Source 6 read-path production-only filter holds.',
      '',
      '## Phase 3 — Targeted signal',
      '',
      '**Status:** PASS',
      '',
      'Targeted text fired 1 positive. 2 positive raw keys observed.',
      '',
      '## Verdict',
      '',
      '**PASS** — ok',
    ].join('\n');
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L4')).toBe(false);
  });

  it('does NOT fire on family-ship audit', () => {
    const doc = buildFamilyShipDoc({
      phases: [['Phase 1 — Pre-flight', 'PASS']],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L4')).toBe(false);
  });
});

/* ============================================================ */
/* 13. L5 rule                                                   */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — L5 rule', () => {
  it('fires on a Family E (argument_scheme) audit without persisted inspection', () => {
    const doc = buildFamilyShipDoc({
      phases: [['Phase 1 — Pre-flight', 'PASS']],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L5')).toBe(true);
  });

  it('does NOT fire when evidence_span inspection is present', () => {
    const doc = [
      '# MCP-SERVER-006-FAMILY-E-SMOKE — body',
      '',
      '## Phase 1 — Pre-flight',
      '',
      '**Status:** PASS',
      '',
      'Family E argument_scheme classifier verified end-to-end.',
      'SELECT evidence_span FROM argument_machine_observation_results;',
      '',
      '## Phase 2 — Local Deno regression',
      '',
      '**Status:** PASS',
      '',
      '## Phase 3 — Hosted MCP smoke',
      '',
      '**Status:** PASS',
      '',
      '## Phase 4 — Edge admin_validation',
      '',
      '**Status:** PASS',
      '',
      '## Phase 5 — Unsupported family rejection',
      '',
      '**Status:** PASS',
      '',
      '## Phase 6 — Targeted regression',
      '',
      '**Status:** PASS',
      '',
      '## Verdict',
      '',
      '**PASS** — ok',
    ].join('\n');
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L5')).toBe(false);
  });

  it('does NOT fire on a non-doctrine-risk family (Family D / evidence_source_chain)', () => {
    const doc = [
      '# MCP-SERVER-005-FAMILY-D-SMOKE — body',
      '',
      '## Phase 1 — Pre-flight',
      '',
      '**Status:** PASS',
      '',
      '## Phase 2 — Local Deno regression',
      '',
      '**Status:** PASS',
      '',
      '## Phase 3 — Hosted MCP smoke',
      '',
      '**Status:** PASS',
      '',
      '## Phase 4 — Edge admin_validation',
      '',
      '**Status:** PASS',
      '',
      '## Phase 5 — Unsupported family rejection',
      '',
      '**Status:** PASS',
      '',
      '## Phase 6 — Targeted regression',
      '',
      '**Status:** PASS',
      '',
      '## Verdict',
      '',
      '**PASS** — ok',
    ].join('\n');
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L5')).toBe(false);
  });

  it('fires when Doctrine-risk: true body declaration is set', () => {
    const doc = [
      '# OPS-SOMETHING-SMOKE — body',
      '',
      'Doctrine-risk: true',
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
    expect(result.findings.some((f) => f.rule === 'L5')).toBe(true);
  });
});

/* ============================================================ */
/* 14. L6 rule                                                   */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — L6 rule', () => {
  it('fires when an amendment is missing newly-supplied-proof language', () => {
    const doc = [
      '# MCP-SERVER-006-FAMILY-E-SMOKE-AMENDMENT — body',
      '',
      '## Verdict (amended)',
      '',
      '**PASS** — fixed up',
      '',
      'Predecessor audit: foo. Gap 1 was identified.',
      '(No language naming the newly-supplied proof.)',
    ].join('\n');
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L6')).toBe(true);
  });

  it('does NOT fire when all three provenance components present', () => {
    const doc = [
      '# MCP-SERVER-006-FAMILY-E-SMOKE-AMENDMENT — body',
      '',
      '## Verdict (amended)',
      '',
      '**PASS** — gap closed',
      '',
      'Predecessor audit: previous file. Gap 1 closed by operator-supplied direct proof.',
    ].join('\n');
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L6')).toBe(false);
  });

  it('does NOT fire on a non-amendment doc', () => {
    const doc = buildFamilyShipDoc({
      phases: [
        ['Phase 1 — Pre-flight', 'PASS'],
        ['Phase 2 — Local Deno regression', 'PASS'],
        ['Phase 3 — Hosted MCP smoke', 'PASS'],
        ['Phase 4 — Edge admin_validation', 'PASS'],
        ['Phase 5 — Unsupported family rejection', 'PASS'],
        ['Phase 6 — Targeted regression', 'PASS'],
      ],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L6')).toBe(false);
  });
});

/* ============================================================ */
/* 15. 4-fixture self-validation (CENTERPIECE)                   */
/* ============================================================ */

const FIXTURE_DIR = path.join(process.cwd(), '__tests__', 'fixtures', 'audit-lint');

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — 4-fixture self-validation', () => {
  it('original Family E improper-PASS FAILS (L1 + L2 trip)', () => {
    const doc = fs.readFileSync(
      path.join(FIXTURE_DIR, 'original-family-e-IMPROPER-PASS.md'),
      'utf8',
    );
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(1);
    const ruleIds = result.findings.map((f) => f.rule);
    expect(ruleIds).toContain('L1');
    expect(ruleIds).toContain('L2');
  });

  it('Family E amendment PARTIAL PASSES (consistent-PARTIAL)', () => {
    const doc = fs.readFileSync(
      path.join(FIXTURE_DIR, 'family-e-amendment-PARTIAL.md'),
      'utf8',
    );
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it('Family E hosted-completion PASS PASSES', () => {
    const doc = fs.readFileSync(
      path.join(FIXTURE_DIR, 'family-e-hosted-completion-PASS.md'),
      'utf8',
    );
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it('Family D strengthened amendment PASS PASSES (model audit)', () => {
    const doc = fs.readFileSync(
      path.join(FIXTURE_DIR, 'family-d-strengthened-amendment-PASS.md'),
      'utf8',
    );
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(0);
    expect(result.findings).toHaveLength(0);
  });
});

/* ============================================================ */
/* 15b. Family F doctrine-risk enrollment                        */
/*     (OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK)         */
/* ============================================================ */

describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK — doctrine-risk membership', () => {
  it('doctrine-risk family set contains critical_question', () => {
    expect(rules.DOCTRINE_RISK_FAMILIES.has('critical_question')).toBe(true);
  });

  it('doctrine-risk family set contains family_f (the detector output)', () => {
    expect(rules.DOCTRINE_RISK_FAMILIES.has('family_f')).toBe(true);
  });

  it('doctrine-risk family set contains consequence_probability_unclear', () => {
    expect(
      rules.DOCTRINE_RISK_FAMILIES.has('consequence_probability_unclear'),
    ).toBe(true);
  });

  it('preserves the existing Family E doctrine-risk members', () => {
    // Additive-only guard: the F enrollment must not drop argument_scheme
    // or slippery_slope (HALT trigger 7).
    expect(rules.DOCTRINE_RISK_FAMILIES.has('argument_scheme')).toBe(true);
    expect(rules.DOCTRINE_RISK_FAMILIES.has('slippery_slope')).toBe(true);
  });
});

describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK — detectFamily A.1-trap pin', () => {
  it('a MCP-SERVER-007-FAMILY-F title detects as family_f (NOT critical_question)', () => {
    // Load-bearing: the title letter F has no case in mapFamilyLetterToName,
    // so it falls through to the default branch -> `family_f`. If a future
    // refactor adds an F case (changing the emitted string) this pin fails
    // loudly rather than silently un-arming L5.
    expect(
      detectFamily(
        '# MCP-SERVER-007-FAMILY-F-SMOKE — Post-merge audit',
        'Phase 4b deferred.',
      ),
    ).toBe('family_f');
  });
});

describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK — L5 fires for family_f', () => {
  it('fires on a family_f audit with verdict PASS and no evidence_span mention', () => {
    const doc = buildFamilyShipDoc({
      titleOverride: '# MCP-SERVER-007-FAMILY-F-SMOKE — synthetic',
      phases: [['Phase 1 — Pre-flight', 'PASS']],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L5')).toBe(true);
  });

  it('does NOT fire on a family_f audit that inspects evidence_span', () => {
    const doc = buildFamilyShipDoc({
      titleOverride: '# MCP-SERVER-007-FAMILY-F-SMOKE — synthetic',
      phases: [
        [
          'Phase 1 — Pre-flight',
          'PASS',
          'SELECT raw_key, confidence, evidence_span FROM argument_machine_observation_results;',
        ],
      ],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L5')).toBe(false);
  });
});

describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-F-DOCTRINE-RISK — Family F fixture self-validation', () => {
  it('family-f-original-PARTIAL PASSES as PARTIAL (consistent-PARTIAL preserved)', () => {
    const doc = fs.readFileSync(
      path.join(FIXTURE_DIR, 'family-f-original-PARTIAL.md'),
      'utf8',
    );
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it('family-f-amendment-PASS PASSES (legitimate F amendment with persisted inspection)', () => {
    const doc = fs.readFileSync(
      path.join(FIXTURE_DIR, 'family-f-amendment-PASS.md'),
      'utf8',
    );
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it('family-f-IMPROPER-PASS-no-evidence-span FAILS on L5 ONLY (the teeth proof)', () => {
    const doc = fs.readFileSync(
      path.join(FIXTURE_DIR, 'family-f-IMPROPER-PASS-no-evidence-span.md'),
      'utf8',
    );
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(1);
    const ruleIds = result.findings.map((f) => f.rule);
    // L5 is the doctrine-risk teeth: verdict PASS + Family F + no evidence_span.
    expect(ruleIds).toContain('L5');
    // Teeth-precision: ONLY L5 trips. The synthetic is amendment-typed (empty
    // required-phase set -> no L1), has no L2 indirect-proof phrase, and its L6
    // provenance is intact -> none of L1/L2/L6 fire.
    expect(ruleIds).not.toContain('L1');
    expect(ruleIds).not.toContain('L2');
    expect(ruleIds).not.toContain('L6');
  });
});

/* ============================================================ */
/* 15c. Family G doctrine-risk enrollment                        */
/*     (OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK)         */
/* ============================================================ */

describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK — doctrine-risk membership', () => {
  it('doctrine-risk family set contains resolution_progress', () => {
    expect(rules.DOCTRINE_RISK_FAMILIES.has('resolution_progress')).toBe(true);
  });

  it('doctrine-risk family set contains family_g (the detector output)', () => {
    expect(rules.DOCTRINE_RISK_FAMILIES.has('family_g')).toBe(true);
  });

  it('doctrine-risk family set contains concedes_broader_point', () => {
    expect(rules.DOCTRINE_RISK_FAMILIES.has('concedes_broader_point')).toBe(
      true,
    );
  });

  it('preserves the existing Family E + F doctrine-risk members', () => {
    // Additive-only guard: the G enrollment must not drop any Family E or F
    // member (HALT trigger 7 / E-F-drift guard).
    expect(rules.DOCTRINE_RISK_FAMILIES.has('argument_scheme')).toBe(true);
    expect(rules.DOCTRINE_RISK_FAMILIES.has('slippery_slope')).toBe(true);
    expect(rules.DOCTRINE_RISK_FAMILIES.has('critical_question')).toBe(true);
    expect(rules.DOCTRINE_RISK_FAMILIES.has('family_f')).toBe(true);
    expect(
      rules.DOCTRINE_RISK_FAMILIES.has('consequence_probability_unclear'),
    ).toBe(true);
  });
});

describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK — detectFamily A.1-trap pin', () => {
  it('a MCP-SERVER-008-FAMILY-G title detects as family_g (NOT resolution_progress)', () => {
    // Load-bearing: the title letter G has no case in mapFamilyLetterToName,
    // so it falls through to the default branch -> `family_g`. If a future
    // refactor adds a G case (changing the emitted string) this pin fails
    // loudly rather than silently un-arming L5.
    expect(
      detectFamily(
        '# MCP-SERVER-008-FAMILY-G-SMOKE — Post-merge audit',
        'Phase 4b deferred.',
      ),
    ).toBe('family_g');
  });
});

describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK — L5 fires for family_g', () => {
  it('fires on a family_g audit with verdict PASS and no evidence_span mention', () => {
    const doc = buildFamilyShipDoc({
      titleOverride: '# MCP-SERVER-008-FAMILY-G-SMOKE — synthetic',
      phases: [['Phase 1 — Pre-flight', 'PASS']],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L5')).toBe(true);
  });

  it('does NOT fire on a family_g audit that inspects evidence_span', () => {
    const doc = buildFamilyShipDoc({
      titleOverride: '# MCP-SERVER-008-FAMILY-G-SMOKE — synthetic',
      phases: [
        [
          'Phase 1 — Pre-flight',
          'PASS',
          'SELECT raw_key, confidence, evidence_span FROM argument_machine_observation_results;',
        ],
      ],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L5')).toBe(false);
  });

  it('family_g PARTIAL audit that names evidence_span does NOT fail L5 (consistent-PARTIAL)', () => {
    // A doctrine-risk G audit that is honestly PARTIAL (a required phase
    // NOT-RUN) must NOT false-fail L5 when it names the deferred / BINDING
    // evidence_span obligation. L5 is verdict-blind; the mention is what
    // satisfies hasInspection.
    const doc = buildFamilyShipDoc({
      titleOverride: '# MCP-SERVER-008-FAMILY-G-SMOKE — synthetic',
      phases: [
        ['Phase 1 — Pre-flight', 'PASS'],
        ['Phase 3 — Hosted MCP smoke', 'NOT-RUN'],
        [
          'Phase 4b — Adversarial doctrine verification',
          'PASS',
          'Persisted evidence_span readback is the binding deferred obligation.',
        ],
      ],
      verdict: 'PARTIAL',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L5')).toBe(false);
  });
});

describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-G-DOCTRINE-RISK — Family G fixture self-validation', () => {
  it('family-g-original-PARTIAL PASSES as PARTIAL (consistent-PARTIAL preserved)', () => {
    const doc = fs.readFileSync(
      path.join(FIXTURE_DIR, 'family-g-original-PARTIAL.md'),
      'utf8',
    );
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it('family-g-amendment-PASS PASSES (representative G amendment with persisted inspection)', () => {
    const doc = fs.readFileSync(
      path.join(FIXTURE_DIR, 'family-g-amendment-PASS.md'),
      'utf8',
    );
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it('family-g-IMPROPER-PASS-no-evidence-span FAILS on L5 ONLY (the teeth proof)', () => {
    const doc = fs.readFileSync(
      path.join(FIXTURE_DIR, 'family-g-IMPROPER-PASS-no-evidence-span.md'),
      'utf8',
    );
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(1);
    const ruleIds = result.findings.map((f) => f.rule);
    // L5 is the doctrine-risk teeth: verdict PASS + Family G + no evidence_span.
    expect(ruleIds).toContain('L5');
    // Teeth-precision: ONLY L5 trips. The synthetic is amendment-typed (empty
    // required-phase set -> no L1), has no L2 indirect-proof phrase, and its L6
    // provenance is intact -> none of L1/L2/L6 fire.
    expect(ruleIds).not.toContain('L1');
    expect(ruleIds).not.toContain('L2');
    expect(ruleIds).not.toContain('L6');
  });
});

/* ============================================================ */
/* 15d. Family H doctrine-risk enrollment                        */
/*     (OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK)         */
/* ============================================================ */

describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK — doctrine-risk membership', () => {
  it('doctrine-risk family set contains claim_clarity', () => {
    expect(rules.DOCTRINE_RISK_FAMILIES.has('claim_clarity')).toBe(true);
  });

  it('doctrine-risk family set contains family_h (the detector output)', () => {
    expect(rules.DOCTRINE_RISK_FAMILIES.has('family_h')).toBe(true);
  });

  it('doctrine-risk family set contains claim_specificity_low', () => {
    expect(rules.DOCTRINE_RISK_FAMILIES.has('claim_specificity_low')).toBe(
      true,
    );
  });

  it('preserves the existing Family E + F + G doctrine-risk members', () => {
    // Additive-only guard: the H enrollment must not drop any Family E, F,
    // or G member (HALT trigger 7 / E-F-G-drift guard). The set-size pin
    // lives in the Family I "preserves E+F+G+H" guard below (the I
    // enrollment carries the canonical post-I size assertion = 14).
    expect(rules.DOCTRINE_RISK_FAMILIES.has('argument_scheme')).toBe(true);
    expect(rules.DOCTRINE_RISK_FAMILIES.has('slippery_slope')).toBe(true);
    expect(rules.DOCTRINE_RISK_FAMILIES.has('critical_question')).toBe(true);
    expect(rules.DOCTRINE_RISK_FAMILIES.has('family_f')).toBe(true);
    expect(
      rules.DOCTRINE_RISK_FAMILIES.has('consequence_probability_unclear'),
    ).toBe(true);
    expect(rules.DOCTRINE_RISK_FAMILIES.has('resolution_progress')).toBe(true);
    expect(rules.DOCTRINE_RISK_FAMILIES.has('family_g')).toBe(true);
    expect(rules.DOCTRINE_RISK_FAMILIES.has('concedes_broader_point')).toBe(
      true,
    );
  });
});

describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK — detectFamily A.1-trap pin', () => {
  it('a MCP-SERVER-009-FAMILY-H title detects as family_h (NOT claim_clarity)', () => {
    // Load-bearing: the title letter H has no case in mapFamilyLetterToName,
    // so it falls through to the default branch -> `family_h`. If a future
    // refactor adds an H case (changing the emitted string) this pin fails
    // loudly rather than silently un-arming L5.
    expect(
      detectFamily(
        '# MCP-SERVER-009-FAMILY-H-SMOKE — Post-merge audit',
        'Phase 4b deferred.',
      ),
    ).toBe('family_h');
  });
});

describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK — L5 fires for family_h', () => {
  it('fires on a family_h audit with verdict PASS and no evidence_span mention', () => {
    const doc = buildFamilyShipDoc({
      titleOverride: '# MCP-SERVER-009-FAMILY-H-SMOKE — synthetic',
      phases: [['Phase 1 — Pre-flight', 'PASS']],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L5')).toBe(true);
  });

  it('does NOT fire on a family_h audit that inspects evidence_span', () => {
    const doc = buildFamilyShipDoc({
      titleOverride: '# MCP-SERVER-009-FAMILY-H-SMOKE — synthetic',
      phases: [
        [
          'Phase 1 — Pre-flight',
          'PASS',
          'SELECT raw_key, confidence, evidence_span FROM argument_machine_observation_results;',
        ],
      ],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L5')).toBe(false);
  });

  it('family_h PASS audit that names evidence_span does NOT fail L5 (consistent-PASS regression)', () => {
    // A doctrine-risk H audit with verdict PASS that names the persisted
    // evidence_span inspection (either as a SELECT query, a table header, a
    // `persisted evidence` phrase, or a `direct-output inspection` phrase)
    // must NOT false-fail L5. L5 is verdict-blind; the mention is what
    // satisfies hasInspection. This documents the consistent-PASS mechanism
    // independently of the static fixture.
    const doc = buildFamilyShipDoc({
      titleOverride: '# MCP-SERVER-009-FAMILY-H-SMOKE — synthetic',
      phases: [
        ['Phase 1 — Pre-flight', 'PASS'],
        [
          'Phase 4b — Adversarial doctrine verification',
          'PASS',
          'Persisted evidence_span readback re-affirmed clean against the H ban-list.',
        ],
      ],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L5')).toBe(false);
  });
});

describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-H-DOCTRINE-RISK — Family H fixture self-validation', () => {
  it('family-h-original-PASS PASSES as exit 0 (Card 1 H smoke baseline; family: null due to title-format quirk)', () => {
    // Load-bearing on-main-preservation regression guard: the Card 1 H smoke
    // audit on main uses a non-canonical title format (`# MCP-SERVER-009
    // Family H smoke — 2026-05-31`, space-separated, lower-case) that does
    // NOT match the family-letter regex. The detector returns `family: null`
    // / `auditType: unknown` → L5 is unreachable → exit 0. This fixture pins
    // that on-main lint outcome verbatim so any future linter/title-format
    // regression is caught. NOTE: this PASS is NOT a doctrine satisfaction;
    // it is a title-format-quirk consequence (see README "H title-format
    // trap" note).
    const doc = fs.readFileSync(
      path.join(FIXTURE_DIR, 'family-h-original-PASS.md'),
      'utf8',
    );
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(0);
    expect(result.findings).toHaveLength(0);
    expect(result.parsed.family).toBe(null);
    expect(result.parsed.auditType).toBe('unknown');
  });

  it('family-h-amendment-PASS PASSES (representative H amendment with persisted inspection)', () => {
    const doc = fs.readFileSync(
      path.join(FIXTURE_DIR, 'family-h-amendment-PASS.md'),
      'utf8',
    );
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(0);
    expect(result.findings).toHaveLength(0);
    expect(result.parsed.family).toBe('family_h');
  });

  it('family-h-IMPROPER-PASS-no-evidence-span FAILS on L5 ONLY (the teeth proof)', () => {
    const doc = fs.readFileSync(
      path.join(FIXTURE_DIR, 'family-h-IMPROPER-PASS-no-evidence-span.md'),
      'utf8',
    );
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(1);
    const ruleIds = result.findings.map((f) => f.rule);
    // L5 is the doctrine-risk teeth: verdict PASS + Family H + no evidence_span.
    expect(ruleIds).toContain('L5');
    // Teeth-precision: ONLY L5 trips. The synthetic is amendment-typed (empty
    // required-phase set -> no L1), has no L2 indirect-proof phrase, and its L6
    // provenance is intact -> none of L1/L2/L6 fire.
    expect(ruleIds).not.toContain('L1');
    expect(ruleIds).not.toContain('L2');
    expect(ruleIds).not.toContain('L6');
  });
});

/* ============================================================ */
/* 15e. Family I doctrine-risk enrollment                        */
/*     (OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK)         */
/* ============================================================ */

describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK — doctrine-risk membership', () => {
  it('doctrine-risk family set contains thread_topology', () => {
    expect(rules.DOCTRINE_RISK_FAMILIES.has('thread_topology')).toBe(true);
  });

  it('doctrine-risk family set contains family_i (the detector output; HALT-11 chain-binding)', () => {
    // HALT trigger 11 (the chain-binding check): `family_i` is the string
    // detectFamily() actually emits for a canonical `MCP-SERVER-NNN-FAMILY-I`
    // title (mapFamilyLetterToName has no I case -> default branch ->
    // `family_i`). Adding only `thread_topology` would be a silent no-op for
    // canonical-titled I docs; `family_i` is the load-bearing alias that arms
    // L5 for them. This membership pin is the HALT-11 satisfaction.
    expect(rules.DOCTRINE_RISK_FAMILIES.has('family_i')).toBe(true);
  });

  it('doctrine-risk family set contains compares_options', () => {
    expect(rules.DOCTRINE_RISK_FAMILIES.has('compares_options')).toBe(true);
  });

  it('preserves the existing Family E + F + G + H doctrine-risk members', () => {
    // Additive-only guard: the I enrollment must not drop any Family E, F, G,
    // or H member (HALT trigger 7 / E-F-G-H-drift guard). Also pins the
    // post-I set size at exactly 14 (was 11 after H; +3 for I = 14) so any
    // future accidental drop or reorder is caught loudly.
    expect(rules.DOCTRINE_RISK_FAMILIES.has('argument_scheme')).toBe(true);
    expect(rules.DOCTRINE_RISK_FAMILIES.has('slippery_slope')).toBe(true);
    expect(rules.DOCTRINE_RISK_FAMILIES.has('critical_question')).toBe(true);
    expect(rules.DOCTRINE_RISK_FAMILIES.has('family_f')).toBe(true);
    expect(
      rules.DOCTRINE_RISK_FAMILIES.has('consequence_probability_unclear'),
    ).toBe(true);
    expect(rules.DOCTRINE_RISK_FAMILIES.has('resolution_progress')).toBe(true);
    expect(rules.DOCTRINE_RISK_FAMILIES.has('family_g')).toBe(true);
    expect(rules.DOCTRINE_RISK_FAMILIES.has('concedes_broader_point')).toBe(
      true,
    );
    expect(rules.DOCTRINE_RISK_FAMILIES.has('claim_clarity')).toBe(true);
    expect(rules.DOCTRINE_RISK_FAMILIES.has('family_h')).toBe(true);
    expect(rules.DOCTRINE_RISK_FAMILIES.has('claim_specificity_low')).toBe(
      true,
    );
    expect(rules.DOCTRINE_RISK_FAMILIES.size).toBe(14);
  });
});

describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK — detectFamily A.1-trap pin', () => {
  it('a MCP-SERVER-010-FAMILY-I title detects as family_i (NOT thread_topology)', () => {
    // Load-bearing: the title letter I has no case in mapFamilyLetterToName,
    // so it falls through to the default branch -> `family_i`. If a future
    // refactor adds an I case (changing the emitted string) this pin fails
    // loudly rather than silently un-arming L5.
    expect(
      detectFamily(
        '# MCP-SERVER-010-FAMILY-I-SMOKE — Post-merge audit',
        'Phase 4b deferred.',
      ),
    ).toBe('family_i');
  });
});

describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK — L5 fires for family_i', () => {
  it('fires on a family_i audit with verdict PASS and no evidence_span mention', () => {
    const doc = buildFamilyShipDoc({
      titleOverride: '# MCP-SERVER-010-FAMILY-I-SMOKE — synthetic',
      phases: [['Phase 1 — Pre-flight', 'PASS']],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L5')).toBe(true);
  });

  it('does NOT fire on a family_i audit that inspects evidence_span', () => {
    const doc = buildFamilyShipDoc({
      titleOverride: '# MCP-SERVER-010-FAMILY-I-SMOKE — synthetic',
      phases: [
        [
          'Phase 1 — Pre-flight',
          'PASS',
          'SELECT raw_key, confidence, evidence_span FROM argument_machine_observation_results;',
        ],
      ],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L5')).toBe(false);
  });

  it('family_i PASS audit that names evidence_span does NOT fail L5 (consistent-PASS regression)', () => {
    // A doctrine-risk I audit with verdict PASS that names the persisted
    // evidence_span inspection (either as a SELECT query, a table header, a
    // `persisted evidence` phrase, or a `direct-output inspection` phrase)
    // must NOT false-fail L5. L5 is verdict-blind; the mention is what
    // satisfies hasInspection. This documents the consistent-PASS mechanism
    // independently of the static fixture.
    const doc = buildFamilyShipDoc({
      titleOverride: '# MCP-SERVER-010-FAMILY-I-SMOKE — synthetic',
      phases: [
        ['Phase 1 — Pre-flight', 'PASS'],
        [
          'Phase 4b — Adversarial doctrine verification',
          'PASS',
          'Persisted evidence_span readback re-affirmed clean against the I ban-list.',
        ],
      ],
      verdict: 'PASS',
    });
    const result = lintAuditDoc(doc);
    expect(result.findings.some((f) => f.rule === 'L5')).toBe(false);
  });
});

describe('OPS-MCP-AUDIT-LINT-RULES-FAMILY-I-DOCTRINE-RISK — Family I fixture self-validation', () => {
  it('family-i-consistent-PARTIAL PASSES as exit 0 (consistent-PARTIAL preserved; substitute for the missing on-main "original")', () => {
    // Load-bearing regression guard: a legitimately-deferred I audit that
    // names `evidence_span` as the deferred Phase 4b obligation still passes
    // L5 (hasInspection true). There is NO on-main Card-1 I smoke to byte-copy
    // (only the -template exists), so this hand-authored representative is the
    // I substitute for H's byte-copy "original" fixture.
    const doc = fs.readFileSync(
      path.join(FIXTURE_DIR, 'family-i-consistent-PARTIAL.md'),
      'utf8',
    );
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(0);
    expect(result.findings).toHaveLength(0);
    expect(result.parsed.family).toBe('family_i');
    expect(result.parsed.verdict).toBe('PARTIAL');
  });

  it('family-i-amendment-PASS PASSES (representative I amendment with persisted inspection)', () => {
    const doc = fs.readFileSync(
      path.join(FIXTURE_DIR, 'family-i-amendment-PASS.md'),
      'utf8',
    );
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(0);
    expect(result.findings).toHaveLength(0);
    expect(result.parsed.family).toBe('family_i');
  });

  it('family-i-IMPROPER-PASS-no-evidence-span FAILS on L5 ONLY (the teeth proof)', () => {
    const doc = fs.readFileSync(
      path.join(FIXTURE_DIR, 'family-i-IMPROPER-PASS-no-evidence-span.md'),
      'utf8',
    );
    const result = lintAuditDoc(doc);
    expect(result.exitCode).toBe(1);
    const ruleIds = result.findings.map((f) => f.rule);
    // L5 is the doctrine-risk teeth: verdict PASS + Family I + no evidence_span.
    expect(ruleIds).toContain('L5');
    // Teeth-precision: ONLY L5 trips. The synthetic is amendment-typed (empty
    // required-phase set -> no L1), has no L2 indirect-proof phrase, and its L6
    // provenance is intact -> none of L1/L2/L6 fire.
    expect(ruleIds).not.toContain('L1');
    expect(ruleIds).not.toContain('L2');
    expect(ruleIds).not.toContain('L6');
  });
});

/* ============================================================ */
/* 16. Fixture-directory invariants                              */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — fixture-directory invariants', () => {
  const FIXTURE_FILES = [
    'original-family-e-IMPROPER-PASS.md',
    'family-e-amendment-PARTIAL.md',
    'family-e-hosted-completion-PASS.md',
    'family-d-strengthened-amendment-PASS.md',
    'family-f-original-PARTIAL.md',
    'family-f-amendment-PASS.md',
    'family-f-IMPROPER-PASS-no-evidence-span.md',
    'family-g-original-PARTIAL.md',
    'family-g-amendment-PASS.md',
    'family-g-IMPROPER-PASS-no-evidence-span.md',
    'family-h-original-PASS.md',
    'family-h-amendment-PASS.md',
    'family-h-IMPROPER-PASS-no-evidence-span.md',
    'family-i-consistent-PARTIAL.md',
    'family-i-amendment-PASS.md',
    'family-i-IMPROPER-PASS-no-evidence-span.md',
  ];

  it('README.md exists with required exclusion-contract content', () => {
    const readmePath = path.join(FIXTURE_DIR, 'README.md');
    expect(fs.existsSync(readmePath)).toBe(true);
    const text = fs.readFileSync(readmePath, 'utf8');
    expect(text).toContain('INTENTIONAL NEGATIVE FIXTURES');
    expect(text).toContain('AUDIT-LINT-FIXTURE');
    expect(text).toContain('Doctrine ban-list scanners');
    expect(text).toContain('DO NOT EDIT');
  });

  it('each fixture file starts with the HTML comment marker', () => {
    for (const filename of FIXTURE_FILES) {
      const text = fs.readFileSync(path.join(FIXTURE_DIR, filename), 'utf8');
      const firstLine = text.split(/\r?\n/, 1)[0];
      expect(firstLine).toContain('<!-- AUDIT-LINT-FIXTURE:');
    }
  });

  it('fixture count is exactly 16', () => {
    const mdFiles = fs
      .readdirSync(FIXTURE_DIR)
      .filter((n) => n.endsWith('.md') && n !== 'README.md');
    expect(mdFiles).toHaveLength(16);
    expect(mdFiles.sort()).toEqual([...FIXTURE_FILES].sort());
  });
});

/* ============================================================ */
/* 17. Determinism                                               */
/* ============================================================ */

describe('OPS-MCP-SMOKE-DOCTRINE-HARDENING — determinism', () => {
  it('same input yields the same finding order across runs', () => {
    const doc = fs.readFileSync(
      path.join(FIXTURE_DIR, 'original-family-e-IMPROPER-PASS.md'),
      'utf8',
    );
    const r1 = lintAuditDoc(doc);
    const r2 = lintAuditDoc(doc);
    const ids1 = r1.findings.map((f) => f.rule + ':' + (f.line || ''));
    const ids2 = r2.findings.map((f) => f.rule + ':' + (f.line || ''));
    expect(ids1).toEqual(ids2);
  });

  it('findings are sorted by rule id then by line number', () => {
    const doc = fs.readFileSync(
      path.join(FIXTURE_DIR, 'original-family-e-IMPROPER-PASS.md'),
      'utf8',
    );
    const r = lintAuditDoc(doc);
    const ruleIds = r.findings.map((f) => f.rule);
    const sorted = [...ruleIds].sort();
    expect(ruleIds).toEqual(sorted);
  });
});

/* ============================================================ */
/* Helpers — buildFamilyShipDoc                                  */
/* ============================================================ */

interface BuildOptions {
  phases: Array<[string, string] | [string, string, string]>;
  verdict: 'PASS' | 'PARTIAL' | 'FAIL';
  titleOverride?: string;
}

function buildFamilyShipDoc(options: BuildOptions): string {
  const title =
    options.titleOverride ||
    '# MCP-SERVER-006-FAMILY-E-SMOKE — synthetic test doc';
  const lines: string[] = [title, '', '**Date:** 2026-05-28', ''];
  for (const phase of options.phases) {
    const [header, status, justification] = phase;
    lines.push('## ' + header);
    lines.push('');
    lines.push('**Status:** ' + status);
    lines.push('');
    if (justification) {
      lines.push(justification);
      lines.push('');
    }
  }
  lines.push('## Verdict');
  lines.push('');
  lines.push('**' + options.verdict + '** — synthetic verdict');
  return lines.join('\n');
}

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

/* ============================================================ */
/* 12. CI scoping classifier + workflow shape                    */
/*    (OPS-MCP-SMOKE-LINT-CI-WIRING)                             */
/* ============================================================ */

const { classifyChangedFiles } = lib;

describe('OPS-MCP-SMOKE-LINT-CI-WIRING — classifyChangedFiles truth table', () => {
  const MARKED_PATH = 'docs/audits/MCP-SERVER-007-FAMILY-F-SMOKE-2026-06-01.md';
  const UNMARKED_PATH =
    'docs/audits/MCP-SERVER-001-FAMILY-A-SMOKE-2026-01-01.md';
  const NON_AUDIT_PATH = 'src/lib/foo.ts';
  const TEMPLATE_PATH =
    'docs/audits/MCP-SERVER-005-FAMILY-D-SMOKE-template.md';

  // The injected reader stub. Returns true iff the path is in the
  // `marked` set (simulates the file containing MARKER_STRING at HEAD).
  function reader(marked: Set<string>) {
    return (p: string) => marked.has(p);
  }

  it('Added smoke audit (status A) without marker -> IN SCOPE', () => {
    const entries = [{ status: 'A', path: UNMARKED_PATH }];
    expect(classifyChangedFiles(entries, reader(new Set()))).toEqual([
      UNMARKED_PATH,
    ]);
  });

  it('Added smoke audit (status A) with marker -> IN SCOPE', () => {
    const entries = [{ status: 'A', path: MARKED_PATH }];
    expect(
      classifyChangedFiles(entries, reader(new Set([MARKED_PATH]))),
    ).toEqual([MARKED_PATH]);
  });

  it('Modified smoke audit (status M) with marker -> IN SCOPE', () => {
    const entries = [{ status: 'M', path: MARKED_PATH }];
    expect(
      classifyChangedFiles(entries, reader(new Set([MARKED_PATH]))),
    ).toEqual([MARKED_PATH]);
  });

  it('Modified smoke audit (status M) without marker -> OUT OF SCOPE', () => {
    const entries = [{ status: 'M', path: UNMARKED_PATH }];
    expect(classifyChangedFiles(entries, reader(new Set()))).toEqual([]);
  });

  it('Non-audit file (status A) -> OUT OF SCOPE', () => {
    const entries = [{ status: 'A', path: NON_AUDIT_PATH }];
    expect(classifyChangedFiles(entries, reader(new Set()))).toEqual([]);
  });

  it('Non-audit file (status M) -> OUT OF SCOPE', () => {
    const entries = [{ status: 'M', path: NON_AUDIT_PATH }];
    expect(
      classifyChangedFiles(entries, reader(new Set([NON_AUDIT_PATH]))),
    ).toEqual([]);
  });

  it('Deleted smoke audit (status D) with marker -> OUT OF SCOPE', () => {
    const entries = [{ status: 'D', path: MARKED_PATH }];
    expect(
      classifyChangedFiles(entries, reader(new Set([MARKED_PATH]))),
    ).toEqual([]);
  });

  it('Template doc (status A) -> OUT OF SCOPE (templates are refused)', () => {
    const entries = [{ status: 'A', path: TEMPLATE_PATH }];
    expect(classifyChangedFiles(entries, reader(new Set()))).toEqual([]);
  });

  it('Multiple entries preserve input order in the in-scope list', () => {
    const entries = [
      { status: 'M', path: UNMARKED_PATH }, // out (no marker)
      { status: 'A', path: MARKED_PATH }, // in (added)
      { status: 'A', path: UNMARKED_PATH }, // in (added always)
    ];
    const out = classifyChangedFiles(
      entries,
      reader(new Set([MARKED_PATH])),
    );
    expect(out).toEqual([MARKED_PATH, UNMARKED_PATH]);
  });

  it('Empty entries -> empty result', () => {
    expect(classifyChangedFiles([], reader(new Set()))).toEqual([]);
  });

  it('readMarkerAtHead is invoked at most once per Modified path; never for A/D/non-audit', () => {
    const calls: string[] = [];
    const tracker = (p: string) => {
      calls.push(p);
      return false;
    };
    classifyChangedFiles(
      [
        { status: 'M', path: UNMARKED_PATH }, // reader called once
        { status: 'A', path: MARKED_PATH }, // A -> reader NOT called
        { status: 'D', path: MARKED_PATH }, // D -> reader NOT called
        { status: 'M', path: NON_AUDIT_PATH }, // non-audit -> reader NOT called
      ],
      tracker,
    );
    expect(calls).toEqual([UNMARKED_PATH]);
  });
});

describe('OPS-MCP-SMOKE-LINT-CI-WIRING — marker string single-source', () => {
  it('classifyChangedFiles uses the same MARKER_STRING as audit-lint-rules.cjs', () => {
    // Re-use the existing marker-presence path via parseAuditDoc as the
    // ground truth: classifyChangedFiles must treat a doc whose body
    // contains rules.MARKER_STRING as marked, and a doc whose body does
    // NOT contain that exact string as unmarked.
    const markedBody = `# x\n\n${rules.MARKER_STRING}\n\nbody`;
    const unmarkedBody = '# x\n\nbody';
    const reader = (p: string) =>
      p === 'docs/audits/M-SMOKE.md'
        ? parseAuditDoc(markedBody).hasMarker
        : p === 'docs/audits/U-SMOKE.md'
          ? parseAuditDoc(unmarkedBody).hasMarker
          : false;
    const inScope = classifyChangedFiles(
      [
        { status: 'M', path: 'docs/audits/M-SMOKE.md' },
        { status: 'M', path: 'docs/audits/U-SMOKE.md' },
      ],
      reader,
    );
    expect(inScope).toEqual(['docs/audits/M-SMOKE.md']);
  });

  it('audit-lint-lib source: no literal "Audit-Lint: v1" string outside rules import', () => {
    // The lib MUST source the marker from the rules file via require().
    // No literal duplication permitted (HALT trigger 11).
    const src = fs.readFileSync(LIB_PATH, 'utf8');
    expect(src).not.toContain("'Audit-Lint: v1'");
    expect(src).not.toContain('"Audit-Lint: v1"');
  });

  it('audit-lint.mjs source: no literal "Audit-Lint: v1" string', () => {
    const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
    expect(src).not.toContain("'Audit-Lint: v1'");
    expect(src).not.toContain('"Audit-Lint: v1"');
  });
});

describe('OPS-MCP-SMOKE-LINT-CI-WIRING — --classify-changed CLI parsing', () => {
  it('parses --classify-changed --base SHA1 --head SHA2', () => {
    const result = parseCliArgs([
      '--classify-changed',
      '--base',
      'abc123',
      '--head',
      'def456',
    ]);
    expect(result.ok).toBe(true);
    expect(result.options?.classifyChanged).toBe(true);
    expect(result.options?.baseSha).toBe('abc123');
    expect(result.options?.headSha).toBe('def456');
  });

  it('rejects --classify-changed with positional doc path', () => {
    const result = parseCliArgs([
      '--classify-changed',
      '--base',
      'a',
      '--head',
      'b',
      'docs/x.md',
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/positional|classify-changed/i);
  });

  it('rejects --classify-changed without --base', () => {
    const result = parseCliArgs(['--classify-changed', '--head', 'b']);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/--base/);
  });

  it('rejects --classify-changed without --head', () => {
    const result = parseCliArgs(['--classify-changed', '--base', 'a']);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/--head/);
  });

  it('parses --changed-list-stdin as alternative to --base/--head', () => {
    const result = parseCliArgs([
      '--classify-changed',
      '--changed-list-stdin',
    ]);
    expect(result.ok).toBe(true);
    expect(result.options?.classifyChanged).toBe(true);
    expect(result.options?.changedListStdin).toBe(true);
  });

  it('rejects --base/--head outside --classify-changed mode', () => {
    const result = parseCliArgs(['docs/x.md', '--base', 'a']);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/--base|classify-changed/i);
  });
});

describe('OPS-MCP-SMOKE-LINT-CI-WIRING — workflow YAML inspection', () => {
  it('workflow file exists at .github/workflows/audit-lint.yml', () => {
    expect(fs.existsSync(WORKFLOW_PATH)).toBe(true);
  });

  it('workflow calls the classifier via --classify-changed', () => {
    const yml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(yml).toContain('audit-lint.mjs --classify-changed');
  });

  it('workflow uses PR base SHA, NOT HEAD~1 / origin/main / ~1', () => {
    const yml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(yml).toContain('${{ github.event.pull_request.base.sha }}');
    expect(yml).not.toContain('HEAD~1');
    expect(yml).not.toContain('origin/main');
    expect(yml).not.toMatch(/git\s+diff\s+~1\b/);
  });

  it('workflow uses PR head SHA', () => {
    const yml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(yml).toContain('${{ github.event.pull_request.head.sha }}');
  });

  it('workflow trigger paths include all 5 patterns from intent §3', () => {
    const yml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(yml).toContain("'docs/audits/**SMOKE*.md'");
    expect(yml).toContain("'scripts/ops/audit-lint.mjs'");
    expect(yml).toContain("'scripts/ops/audit-lint-lib.cjs'");
    expect(yml).toContain("'scripts/ops/audit-lint-rules.cjs'");
    expect(yml).toContain("'__tests__/fixtures/audit-lint/**'");
  });

  it('workflow uses actions/checkout@v4 with fetch-depth: 0', () => {
    const yml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(yml).toContain('actions/checkout@v4');
    expect(yml).toMatch(/fetch-depth:\s*0/);
  });

  it('workflow uses actions/setup-node@v4 with Node 20.x', () => {
    const yml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(yml).toContain('actions/setup-node@v4');
    expect(yml).toMatch(/node-version:\s*'?20/);
  });

  it('workflow has read-only permissions on contents', () => {
    const yml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(yml).toMatch(/permissions:\s*[\s\S]*?contents:\s*read/);
  });

  it('workflow does NOT contain a literal "Audit-Lint: v1" marker string', () => {
    // Single-source rule: the marker lives in audit-lint-rules.cjs.
    // The workflow only invokes the classifier, which sources the marker
    // through the lib.
    const yml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(yml).not.toContain('Audit-Lint: v1');
  });

  it('workflow does NOT implement inline added-vs-modified scoping logic', () => {
    // No git diff --name-status invocation; no marker-substring grep
    // in YAML/bash. All scoping logic must live in the classifier.
    const yml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    expect(yml).not.toContain('git diff --name-status');
    expect(yml).not.toContain('grep -q "Audit-Lint: v1"');
    expect(yml).not.toMatch(/git\s+show.*Audit-Lint/);
  });
});

describe('OPS-MCP-SMOKE-LINT-CI-WIRING — lib export + purity discipline', () => {
  it('lib source: classifyChangedFiles is exported and named in module.exports', () => {
    const src = fs.readFileSync(LIB_PATH, 'utf8');
    expect(src).toContain('classifyChangedFiles');
    expect(src).toContain('module.exports');
  });

  it('lib source: classifyChangedFiles preserves pure-helper discipline (no fs / no spawn / no fetch)', () => {
    // Re-asserts the Block 10 invariant after classifyChangedFiles
    // landed. The classifier accepts an injected reader closure so the
    // lib itself remains free of fs / spawn / network references.
    const src = fs.readFileSync(LIB_PATH, 'utf8');
    expect(src).not.toContain('readFileSync');
    expect(src).not.toContain('spawnSync');
    expect(src).not.toContain('global.fetch');
  });
});
