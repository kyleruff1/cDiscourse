/**
 * Tests for scripts/github/agentIssueRunner.js
 *
 * All tests cover pure helpers — no `gh` is invoked, no network is hit.
 * The runner is loaded as a CommonJS module; mutation paths are tested
 * via planClaim/planSignoff (which return command arrays) rather than
 * by spawning processes.
 */
const path = require('path');
const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'github', 'agentIssueRunner.js');
const runner = require(SCRIPT);

// Minimal local shapes used to type the dynamically-required runner's
// values without pulling in a full .d.ts for a JS module.
type Issue = { number: number; title: string; labels: Array<string | { name: string }> };
type PlanItem = { kind: string; cmd: string[] };

describe('agentIssueRunner', () => {
  // ── parseArgs ─────────────────────────────────────────────────────
  describe('parseArgs', () => {
    it('returns no command when called with bare argv', () => {
      const args = runner.parseArgs(['node', 'agentIssueRunner.js']);
      expect(args.command).toBeNull();
      expect(args.apply).toBe(false);
    });

    it('parses queue command with --apply explicit off', () => {
      const args = runner.parseArgs(['node', 'agentIssueRunner.js', 'queue', '--dry']);
      expect(args.command).toBe('queue');
      expect(args.apply).toBe(false);
    });

    it('parses claim command with all flags', () => {
      const args = runner.parseArgs([
        'node', 'agentIssueRunner.js', 'claim',
        '--issue', '18', '--agent', 'timeline-ui-agent',
        '--branch', 'agent/18-sw-001',
        '--apply',
      ]);
      expect(args.command).toBe('claim');
      expect(args.flags.issue).toBe('18');
      expect(args.flags.agent).toBe('timeline-ui-agent');
      expect(args.flags.branch).toBe('agent/18-sw-001');
      expect(args.apply).toBe(true);
    });

    it('parses bare boolean flag (no value)', () => {
      const args = runner.parseArgs(['node', 'agentIssueRunner.js', 'queue', '--verbose']);
      expect(args.flags.verbose).toBe(true);
    });
  });

  // ── parseIssuePrefix ─────────────────────────────────────────────
  describe('parseIssuePrefix', () => {
    it('parses every supported roadmap prefix', () => {
      for (const fam of runner.ROADMAP_PREFIXES) {
        const parsed = runner.parseIssuePrefix(`${fam}-007 — Something`);
        expect(parsed).toEqual({ prefix: `${fam}-007`, family: fam, number: 7 });
      }
    });

    it('rejects non-roadmap prefix', () => {
      expect(runner.parseIssuePrefix('XX-001 - unknown')).toBeNull();
      expect(runner.parseIssuePrefix('bug fix something')).toBeNull();
      expect(runner.parseIssuePrefix('')).toBeNull();
      expect(runner.parseIssuePrefix(null as unknown as string)).toBeNull();
    });

    it('handles QOL-NNN cards', () => {
      const parsed = runner.parseIssuePrefix('QOL-018 - Repo-local Claude agent charters');
      expect(parsed).toEqual({ prefix: 'QOL-018', family: 'QOL', number: 18 });
    });
  });

  // ── readLabel ─────────────────────────────────────────────────────
  describe('readLabel', () => {
    it('reads a label as string-array entry', () => {
      expect(runner.readLabel(['priority:p0', 'release:6.5', 'area:roadmap'], 'priority')).toBe('p0');
      expect(runner.readLabel(['priority:p0'], 'release')).toBeNull();
    });

    it('reads a label as object-array entry', () => {
      expect(runner.readLabel([{ name: 'effort:m' }, { name: 'release:6.6' }], 'effort')).toBe('m');
    });

    it('returns null for non-array', () => {
      expect(runner.readLabel(null as unknown as string, 'priority')).toBeNull();
    });
  });

  // ── compareIssuesForQueue ─────────────────────────────────────────
  describe('compareIssuesForQueue', () => {
    const mkIssue = (n: number, pri: string, rel: string, eff: string) => ({
      number: n,
      title: `TL-${String(n).padStart(3, '0')} - test`,
      labels: [`priority:${pri}`, `release:${rel}`, `effort:${eff}`, 'area:roadmap'],
    });

    it('orders P0 before P1 before P2', () => {
      const items = [mkIssue(3, 'p2', '6.5', 's'), mkIssue(1, 'p0', '6.5', 's'), mkIssue(2, 'p1', '6.5', 's')];
      const sorted = items.slice().sort(runner.compareIssuesForQueue);
      expect(sorted.map((i: Issue) => i.number)).toEqual([1, 2, 3]);
    });

    it('within priority, orders 6.5 before 6.6 before 6.7 before 6.8', () => {
      const items = [mkIssue(3, 'p0', '6.7', 's'), mkIssue(1, 'p0', '6.5', 's'), mkIssue(2, 'p0', '6.6', 's')];
      const sorted = items.slice().sort(runner.compareIssuesForQueue);
      expect(sorted.map((i: Issue) => i.number)).toEqual([1, 2, 3]);
    });

    it('within release, orders S before M before L before XL', () => {
      const items = [mkIssue(3, 'p0', '6.5', 'l'), mkIssue(1, 'p0', '6.5', 's'), mkIssue(2, 'p0', '6.5', 'm')];
      const sorted = items.slice().sort(runner.compareIssuesForQueue);
      expect(sorted.map((i: Issue) => i.number)).toEqual([1, 2, 3]);
    });

    it('falls back to issue number ascending', () => {
      const items = [mkIssue(99, 'p0', '6.5', 's'), mkIssue(1, 'p0', '6.5', 's'), mkIssue(42, 'p0', '6.5', 's')];
      const sorted = items.slice().sort(runner.compareIssuesForQueue);
      expect(sorted.map((i: Issue) => i.number)).toEqual([1, 42, 99]);
    });

    it('items with no labels sink to the bottom', () => {
      const items = [mkIssue(1, 'p0', '6.5', 's'), { number: 99, title: 'TL-099 - x', labels: [] }];
      const sorted = items.slice().sort(runner.compareIssuesForQueue);
      expect(sorted[0].number).toBe(1);
      expect(sorted[1].number).toBe(99);
    });
  });

  // ── renderCommitFooter ────────────────────────────────────────────
  describe('renderCommitFooter', () => {
    const base = {
      issueNumber: 18,
      productStatus: 'Needs Review',
      projectStatus: 'In Progress',
      projectPhase: 'Review',
      verification: { typecheck: 'pass', lint: 'pass', tests: '1942' },
      agent: 'timeline-ui-agent',
      scope: 'add strength-band tokens',
      docs: 'no',
    };

    it('produces the canonical footer with Refs (partial)', () => {
      const out = runner.renderCommitFooter(base);
      expect(out).toContain('Refs: #18');
      expect(out).toContain('Product-Status: Needs Review');
      expect(out).toContain('Project-Status: In Progress');
      expect(out).toContain('Project-Phase: Review');
      expect(out).toContain('Verification: typecheck=pass; lint=pass; tests=1942');
      expect(out).toContain('Agent: timeline-ui-agent');
      expect(out).toContain('Scope: add strength-band tokens');
      expect(out).toContain('Docs: no');
      expect(out).not.toContain('Closes #');
    });

    it('uses Closes #<n> when closes flag is true', () => {
      const out = runner.renderCommitFooter({ ...base, closes: true });
      expect(out).toContain('Closes #18');
      expect(out).not.toContain('Refs: #18');
    });

    it('appends Notes line only when provided', () => {
      expect(runner.renderCommitFooter(base)).not.toContain('Notes:');
      expect(runner.renderCommitFooter({ ...base, notes: 'pre-existing flake X' })).toContain('Notes: pre-existing flake X');
    });
  });

  // ── renderClaimComment ───────────────────────────────────────────
  describe('renderClaimComment', () => {
    it('produces a comment naming agent, branch, scope, and verification target', () => {
      const out = runner.renderClaimComment({
        agent: 'sidecar-tools-agent',
        branch: 'agent/9-sc-001',
        scope: 'rebuild side rail action set',
        verificationTargets: ['npm run typecheck', 'npm run lint', 'npm run test'],
      });
      expect(out).toContain('Agent started: `sidecar-tools-agent`');
      expect(out).toContain('Branch: `agent/9-sc-001`');
      expect(out).toContain('Scope: rebuild side rail action set');
      expect(out).toContain('npm run typecheck && npm run lint && npm run test');
      expect(out).toContain('Posted by `scripts/github/agentIssueRunner.js claim`');
    });
  });

  // ── renderSignoffComment ─────────────────────────────────────────
  describe('renderSignoffComment', () => {
    const base = {
      agent: 'timeline-ui-agent',
      commit: 'deadbee',
      subject: 'tl-001: timeline as default landing',
      verification: { typecheck: 'pass', lint: 'pass', tests: '1942' },
      productStatus: 'Needs Review',
      filesChanged: 4,
      topFiles: ['src/x.ts', 'src/y.tsx', '__tests__/z.test.ts'],
      remainingGaps: ['operator visual walkthrough'],
      issueClosed: false,
    };

    it('renders the canonical sign-off comment', () => {
      const out = runner.renderSignoffComment(base);
      expect(out).toContain('Agent finished: `timeline-ui-agent`');
      expect(out).toContain('Commit: `deadbee`');
      expect(out).toContain('Verification: `typecheck=pass; lint=pass; tests=1942`');
      expect(out).toContain('Product status: `Needs Review`');
      expect(out).toContain('Files changed: 4');
      expect(out).toContain('operator visual walkthrough');
      expect(out).toContain('Issue status: still open');
    });

    it('shows "closed" when issueClosed=true', () => {
      const out = runner.renderSignoffComment({ ...base, issueClosed: true });
      expect(out).toContain('Issue status: closed');
    });

    it('writes "none" when there are no remaining gaps', () => {
      const out = runner.renderSignoffComment({ ...base, remainingGaps: [] });
      expect(out).toContain('Remaining gaps: none');
    });
  });

  // ── validateSignoffTransition ────────────────────────────────────
  describe('validateSignoffTransition', () => {
    it('accepts each documented status', () => {
      for (const s of runner.VALID_SIGNOFF_STATUSES) {
        const issues = runner.validateSignoffTransition({ status: s, commitBody: s === 'Done' ? 'Closes #1' : '' });
        expect(issues).toEqual([]);
      }
    });

    it('rejects an unknown status', () => {
      const issues = runner.validateSignoffTransition({ status: 'Shipped' });
      expect(issues.some((i: string) => i.includes('unknown status'))).toBe(true);
    });

    it('rejects Done without "Closes #<n>" in commit body', () => {
      const issues = runner.validateSignoffTransition({ status: 'Done', commitBody: 'Refs: #18' });
      expect(issues.some((i: string) => i.includes('requires the commit body'))).toBe(true);
    });

    it('accepts Done with proper Closes reference', () => {
      const issues = runner.validateSignoffTransition({ status: 'Done', commitBody: 'Closes #18\n\nfoo' });
      expect(issues).toEqual([]);
    });
  });

  // ── isUnsafeStagedPath ───────────────────────────────────────────
  describe('isUnsafeStagedPath', () => {
    const unsafe = [
      '.env',
      '.env.local',
      '.env.engagement-intelligence',
      'logs/foo.log',
      'logs/engagement-intelligence/run-1.jsonl',
      'artifacts/diagnostics/inspect.zip',
      'node_modules/foo/index.js',
      '.expo/state.json',
      '.claude/worktrees/cranky-rubin/file.ts',
      'data/engagement-intelligence/raw/post.json',
      'fixtures/random.jsonl',
    ];
    const safe = [
      'docs/agent-workflow.md',
      'src/features/debates/foo.ts',
      '__tests__/foo.test.ts',
      'scripts/github/agentIssueRunner.js',
      'package.json',
      'src/lib/.envCheck.ts',
    ];

    for (const p of unsafe) {
      it(`flags as unsafe: ${p}`, () => {
        expect(runner.isUnsafeStagedPath(p)).toBe(true);
      });
    }
    for (const p of safe) {
      it(`accepts: ${p}`, () => {
        expect(runner.isUnsafeStagedPath(p)).toBe(false);
      });
    }

    it('handles Windows-style backslashes', () => {
      expect(runner.isUnsafeStagedPath('logs\\engagement-intelligence\\run.jsonl')).toBe(true);
    });
  });

  // ── renderLedgerRow / renderQueueRow ─────────────────────────────
  describe('renderLedgerRow', () => {
    const issue = { number: 18, title: 'SW-001 - Strong vs weak talking point bands', labels: [] };

    it('renders a Not Started row with em dashes', () => {
      const row = runner.renderLedgerRow({
        date: '2026-05-18', issue, status: 'Not Started',
        commit: null, agent: null, verification: null, notes: '',
      });
      expect(row).toBe('| 2026-05-18 | #18 SW-001 | Strong vs weak talking point bands | Not Started | — | — | — |  |');
    });

    it('renders a Done row with verification cell', () => {
      const row = runner.renderLedgerRow({
        date: '2026-05-18', issue, status: 'Done',
        commit: 'abc1234', agent: 'timeline-ui-agent',
        verification: { typecheck: 'pass', lint: 'pass', tests: '1942' },
        notes: 'ships strength bands',
      });
      expect(row).toContain('| Done | abc1234 | timeline-ui-agent | tc=pass; lint=pass; tests=1942 | ships strength bands |');
    });
  });

  describe('renderQueueRow', () => {
    it('renders an aligned queue row', () => {
      const row = runner.renderQueueRow({
        number: 18,
        title: 'SW-001 - Strong vs weak talking point bands',
        labels: ['priority:p0', 'release:6.5', 'effort:m', 'area:roadmap'],
      });
      expect(row).toContain('SW-001');
      expect(row).toContain('p0');
      expect(row).toContain('6.5');
      expect(row).toContain('Strong vs weak talking point bands');
    });
  });

  // ── planClaimCommands / planSignoffCommands ──────────────────────
  describe('planClaimCommands', () => {
    it('produces a comment + add-label plan', () => {
      const plan = runner.planClaimCommands({ issueNumber: 18, comment: 'hello' });
      expect(plan).toHaveLength(2);
      expect(plan[0].kind).toBe('comment');
      expect(plan[0].cmd[0]).toBe('gh');
      expect(plan[0].cmd).toContain('--body');
      expect(plan[0].cmd).toContain('hello');
      expect(plan[1].kind).toBe('label');
      expect(plan[1].cmd).toContain('--add-label');
      expect(plan[1].cmd).toContain('agent:active');
    });
  });

  describe('planSignoffCommands', () => {
    it('Done with project item id includes status + phase + close + done label', () => {
      const plan = runner.planSignoffCommands({
        issueNumber: 18,
        comment: 'ok',
        status: 'Done',
        projectItemId: 'PVTI_xxx',
        closeIssue: true,
      });
      const kinds = plan.map((p: PlanItem) => p.kind);
      expect(kinds).toEqual(['comment', 'project-status', 'project-phase', 'unlabel', 'label', 'close']);
      const phaseStep = plan.find((p: PlanItem) => p.kind ==='project-phase');
      // The Done phase id must be the captured static option id.
      expect(phaseStep.cmd).toContain('db9343eb');
    });

    it('Needs Review keeps Status=In Progress + Phase=Review and does not close', () => {
      const plan = runner.planSignoffCommands({
        issueNumber: 18,
        comment: 'ok',
        status: 'Needs Review',
        projectItemId: 'PVTI_xxx',
        closeIssue: false,
      });
      const phaseStep = plan.find((p: PlanItem) => p.kind ==='project-phase');
      const statusStep = plan.find((p: PlanItem) => p.kind ==='project-status');
      expect(phaseStep.cmd).toContain('872509bd');
      expect(statusStep.cmd).toContain('47fc9ee4');
      expect(plan.find((p: PlanItem) => p.kind ==='close')).toBeUndefined();
    });

    it('Blocked adds agent:blocked label', () => {
      const plan = runner.planSignoffCommands({
        issueNumber: 18,
        comment: 'ok',
        status: 'Blocked',
        projectItemId: 'PVTI_xxx',
        closeIssue: false,
      });
      const labelStep = plan.find((p: PlanItem) => p.kind ==='label');
      expect(labelStep.cmd).toContain('agent:blocked');
    });

    it('skips project mutation steps when projectItemId is missing', () => {
      const plan = runner.planSignoffCommands({
        issueNumber: 18,
        comment: 'ok',
        status: 'Done',
        projectItemId: null,
        closeIssue: true,
      });
      expect(plan.find((p: PlanItem) => p.kind ==='project-status')).toBeUndefined();
      expect(plan.find((p: PlanItem) => p.kind ==='project-phase')).toBeUndefined();
      expect(plan.find((p: PlanItem) => p.kind ==='comment')).toBeDefined();
      expect(plan.find((p: PlanItem) => p.kind ==='close')).toBeDefined();
    });
  });

  // ── STATUS_TO_PROJECT mapping is exhaustive ──────────────────────
  describe('STATUS_TO_PROJECT', () => {
    it('covers every valid sign-off status', () => {
      for (const s of runner.VALID_SIGNOFF_STATUSES) {
        expect(runner.STATUS_TO_PROJECT[s]).toBeDefined();
        expect(runner.STATUS_TO_PROJECT[s].status).toBeDefined();
        expect(runner.STATUS_TO_PROJECT[s].phase).toBeDefined();
      }
    });

    it('maps the documented values exactly', () => {
      expect(runner.STATUS_TO_PROJECT.Done).toEqual({ status: 'Done', phase: 'Done' });
      expect(runner.STATUS_TO_PROJECT['Needs Review']).toEqual({ status: 'In Progress', phase: 'Review' });
      expect(runner.STATUS_TO_PROJECT.Blocked).toEqual({ status: 'In Progress', phase: 'Blocked' });
      expect(runner.STATUS_TO_PROJECT['In Progress']).toEqual({ status: 'In Progress', phase: 'Build' });
    });
  });

  // ── resolveGhBin (Windows + non-Windows binary resolution) ───────
  describe('resolveGhBin', () => {
    // A working candidate returns status:0; everything else returns status:1.
    const mkSpawn = (workingCandidates: string[]) =>
      (bin: string) => ({ status: workingCandidates.includes(bin) ? 0 : 1 });

    it('honors GH_BIN above everything else, even on Windows', () => {
      const resolved = runner.resolveGhBin({
        env: { GH_BIN: '/custom/path/gh.exe' },
        platform: 'win32',
        spawn: mkSpawn(['/custom/path/gh.exe', 'gh.exe', 'gh']),
      });
      expect(resolved).toBe('/custom/path/gh.exe');
    });

    it('on Windows, prefers gh.exe when GH_BIN is unset', () => {
      const resolved = runner.resolveGhBin({
        env: {},
        platform: 'win32',
        spawn: mkSpawn(['gh.exe', 'gh.cmd', 'gh']),
      });
      expect(resolved).toBe('gh.exe');
    });

    it('on Windows, falls back to gh.cmd when gh.exe is unavailable', () => {
      const resolved = runner.resolveGhBin({
        env: {},
        platform: 'win32',
        spawn: mkSpawn(['gh.cmd', 'gh']),
      });
      expect(resolved).toBe('gh.cmd');
    });

    it('on Windows, falls back to bare gh when neither .exe nor .cmd works', () => {
      const resolved = runner.resolveGhBin({
        env: {},
        platform: 'win32',
        spawn: mkSpawn(['gh']),
      });
      expect(resolved).toBe('gh');
    });

    it('on non-Windows, resolves bare gh', () => {
      const resolved = runner.resolveGhBin({
        env: {},
        platform: 'linux',
        spawn: mkSpawn(['gh']),
      });
      expect(resolved).toBe('gh');
    });

    it('throws a directive error mentioning GH_BIN when nothing resolves', () => {
      expect(() => runner.resolveGhBin({
        env: {},
        platform: 'win32',
        spawn: mkSpawn([]),
      })).toThrow(/GH_BIN/);
    });

    it('throws a directive error mentioning all tried candidates on Windows', () => {
      expect(() => runner.resolveGhBin({
        env: {},
        platform: 'win32',
        spawn: mkSpawn([]),
      })).toThrow(/gh\.exe.*gh\.cmd.*gh/);
    });

    it('treats spawner that throws (ENOENT-style) the same as status 1', () => {
      const throwingSpawn = (bin: string) => {
        if (bin === 'gh.exe') throw new Error('ENOENT');
        if (bin === 'gh.cmd') return { status: 0 };
        return { status: 1 };
      };
      const resolved = runner.resolveGhBin({
        env: {},
        platform: 'win32',
        spawn: throwingSpawn,
      });
      expect(resolved).toBe('gh.cmd');
    });

    it('does not invoke the spawner at all once a candidate works', () => {
      const calls: string[] = [];
      const recordingSpawn = (bin: string) => {
        calls.push(bin);
        return { status: bin === 'gh.exe' ? 0 : 1 };
      };
      runner.resolveGhBin({
        env: {},
        platform: 'win32',
        spawn: recordingSpawn,
      });
      // gh.exe wins on first probe; .cmd / bare gh should never be probed.
      expect(calls).toEqual(['gh.exe']);
    });

    it('error message includes a how-to-set-GH_BIN hint', () => {
      let caught: Error | null = null;
      try {
        runner.resolveGhBin({
          env: {},
          platform: 'win32',
          spawn: mkSpawn([]),
        });
      } catch (e) {
        caught = e as Error;
      }
      expect(caught).not.toBeNull();
      expect((caught as Error).message).toMatch(/GH_BIN/);
      expect((caught as Error).message).toMatch(/path/i);
    });
  });

  // ── No tokens / no secrets in source ─────────────────────────────
  describe('source-file safety', () => {
    it('source file contains no secret-shape literal', () => {
      const fs = require('fs');
      const src = fs.readFileSync(SCRIPT, 'utf8');
      const secretShapes = [
        /sk-ant-[A-Za-z0-9_-]{12,}/,
        /xai-[A-Za-z0-9_-]{20,}/,
        /sb_secret_[A-Za-z0-9_-]{8,}/,
        /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/,
        /Bearer\s+[A-Za-z0-9._-]{16,}/,
      ];
      for (const re of secretShapes) {
        expect(src).not.toMatch(re);
      }
    });
  });
});
