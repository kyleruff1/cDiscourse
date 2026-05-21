/**
 * Tests for scripts/ux/auditUserFacingTerminology.js — the deterministic
 * normal-user UI terminology scanner.
 */
const fs = require('fs');
const path = require('path');

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'ux', 'auditUserFacingTerminology.js');
const PKG = path.resolve(__dirname, '..', 'package.json');

const audit = require(SCRIPT);

describe('uxTerminologyAudit — wiring', () => {
  it('the audit script exists', () => {
    expect(fs.existsSync(SCRIPT)).toBe(true);
  });

  it('exports the pure helpers and the runner', () => {
    for (const fn of [
      'classifyText',
      'isUserCopyCandidate',
      'extractCandidatesFromLine',
      'auditFile',
      'runAudit',
      'renderReport',
    ]) {
      expect(typeof (audit as Record<string, unknown>)[fn]).toBe('function');
    }
  });

  it('package.json wires the `ux:terminology:audit` script', () => {
    const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));
    expect(pkg.scripts['ux:terminology:audit']).toBe(
      'node scripts/ux/auditUserFacingTerminology.js',
    );
  });

  it('the report path points inside docs/ux-storyboards', () => {
    expect(audit.REPORT_PATH.replace(/\\/g, '/')).toBe('docs/ux-storyboards/terminology-audit.md');
  });
});

describe('uxTerminologyAudit — classifyText (prohibited)', () => {
  const term = (text: string) => audit.classifyText(text).map((f: { term: string }) => f.term);
  const sev = (text: string) => audit.classifyText(text).map((f: { severity: string }) => f.severity);

  it('flags "game" in a sentence as prohibited', () => {
    expect(term('This is the current game state')).toContain('game');
    expect(sev('This is the current game state')).toContain('prohibited');
  });

  it('flags "Tap to join" as prohibited', () => {
    expect(term('Tap to join this room')).toContain('Tap to join');
  });

  it('flags "debate room" as prohibited', () => {
    expect(term('Start a new debate room')).toContain('debate room');
  });

  it('flags "winner" and "loser" in a sentence as prohibited', () => {
    expect(term('You are the winner of this round')).toContain('winner');
    expect(term('Nobody is the loser here')).toContain('loser');
  });

  it('flags "player" in a sentence as prohibited', () => {
    expect(term('Another player joined the room')).toContain('player');
  });

  it('flags the exact page/tab label "Debates" as prohibited', () => {
    expect(term('Debates')).toContain('Debates (page/tab label)');
    expect(sev('Debates')).toEqual(['prohibited']);
  });
});

describe('uxTerminologyAudit — classifyText (discouraged)', () => {
  const term = (text: string) => audit.classifyText(text).map((f: { term: string }) => f.term);
  const sev = (text: string) => audit.classifyText(text).map((f: { severity: string }) => f.severity);

  it('flags "debate" in a sentence as discouraged', () => {
    expect(term('Challenging the framing of the debate')).toContain('debate');
    expect(sev('Challenging the framing of the debate')).toContain('discouraged');
  });

  it('flags "moderator" in a sentence as discouraged', () => {
    expect(term('Flagged for moderator review')).toContain('moderator');
  });
});

describe('uxTerminologyAudit — classifyText (clean copy passes)', () => {
  it('does not flag the approved replacements', () => {
    for (const clean of ['Open', 'Observe', 'Respond', 'Jump in', 'Argument room', 'Start an argument']) {
      expect(audit.classifyText(clean)).toEqual([]);
    }
  });
});

describe('uxTerminologyAudit — code constants are not copy', () => {
  it('a bare single-word token is not flagged (ban-list / enum constant)', () => {
    // `winner` / `loser` / `game` appear constantly as ban-list entries and
    // enum values — a bare token with no whitespace is code, not UI copy.
    expect(audit.classifyText('winner')).toEqual([]);
    expect(audit.classifyText('loser')).toEqual([]);
    expect(audit.classifyText('game')).toEqual([]);
    expect(audit.classifyText('player')).toEqual([]);
  });

  it('the lowercase `debates` table name is not flagged', () => {
    expect(audit.classifyText('debates')).toEqual([]);
  });

  it('a roadmap card id (GAME-002) does not trip the game pattern', () => {
    expect(audit.classifyText('pacing is built via GAME-002')).toEqual([]);
  });
});

describe('uxTerminologyAudit — isUserCopyCandidate', () => {
  it('accepts a real sentence', () => {
    expect(audit.isUserCopyCandidate('Hello there world')).toBe(true);
  });

  it('rejects import paths, identifiers and style values', () => {
    for (const code of ['./foo/bar', '@scope/pkg', 'snake_case_value', 'camelCaseValue', '#ff00aa']) {
      expect(audit.isUserCopyCandidate(code)).toBe(false);
    }
  });
});

describe('uxTerminologyAudit — extractCandidatesFromLine', () => {
  it('pulls string literals out of a line', () => {
    const got = audit.extractCandidatesFromLine("const label = 'Start an argument';");
    expect(got).toContain('Start an argument');
  });

  it('pulls plain JSX text out of a line', () => {
    const got = audit.extractCandidatesFromLine('<Text>Open the room</Text>');
    expect(got).toContain('Open the room');
  });
});

describe('uxTerminologyAudit — auditFile + comment handling', () => {
  it('a term inside a comment is not flagged (comments are stripped)', () => {
    const src = "const ok = 'Open'; // this game comment must not flag\n";
    const findings = audit.auditFile('src/example.tsx', src);
    expect(findings).toEqual([]);
  });

  it('an apostrophe in a comment never starts a fake string literal', () => {
    // `bot's` once misfired the literal scanner — comment stripping fixes it.
    const src = "// the bot's posted move references GAME-004 here\nconst x = 1;\n";
    const findings = audit.auditFile('src/example.tsx', src);
    expect(findings).toEqual([]);
  });

  it('honours an `ux-audit-ignore-line` marker', () => {
    const src = "const bad = 'Tap to join now'; // ux-audit-ignore-line\n";
    const findings = audit.auditFile('src/example.tsx', src);
    expect(findings).toEqual([]);
  });

  it('flags a genuine prohibited string in a real literal', () => {
    const src = "const cta = 'Tap to join now';\n";
    const findings = audit.auditFile('src/example.tsx', src);
    expect(findings.map((f: { term: string }) => f.term)).toContain('Tap to join');
  });
});

describe('uxTerminologyAudit — runAudit', () => {
  const result = audit.runAudit();

  it('returns the structured result shape', () => {
    expect(typeof result.scannedFileCount).toBe('number');
    expect(Array.isArray(result.liveFindings)).toBe(true);
    expect(Array.isArray(result.liveProhibited)).toBe(true);
    expect(Array.isArray(result.liveDiscouraged)).toBe(true);
    expect(Array.isArray(result.legacyFindings)).toBe(true);
  });

  it('scans a non-trivial number of app source files', () => {
    expect(result.scannedFileCount).toBeGreaterThan(50);
  });

  it('regression: zero live prohibited violations remain in mounted surfaces', () => {
    // This pass fixed the live prohibited strings. Keep it at zero — a
    // regression here means a "game" / "debate room" / "Tap to join" /
    // "winner" / "loser" string landed in a mounted user-facing surface.
    expect(result.liveProhibited).toEqual([]);
  });

  it('renderReport produces a Markdown report with the expected heading', () => {
    const report = audit.renderReport(result);
    expect(report).toContain('# CDiscourse — User-Facing Terminology Audit');
    expect(report).toContain('## Live prohibited violations');
  });

  it('scopes to normal-user mode — admin / operator screens are not scanned', () => {
    // The terminology rule is normal-user-mode doctrine. Admin screens serve
    // operators and may use "debate" / "moderator" / technical terms — they
    // must never appear as audit findings.
    const allFindings = [
      ...result.liveFindings,
      ...result.legacyFindings,
    ];
    const adminFindings = allFindings.filter((f: { file: string }) =>
      f.file.replace(/\\/g, '/').includes('src/features/admin/'),
    );
    expect(adminFindings).toEqual([]);
  });

  it('the audit declares `admin` in its skip set', () => {
    // Defense in depth — the exclusion is a deliberate config entry, not an
    // accident of the walk.
    const fs2 = require('fs');
    const src = fs2.readFileSync(SCRIPT, 'utf8');
    expect(src).toMatch(/SKIP_DIR_NAMES[\s\S]*'admin'/);
  });
});
