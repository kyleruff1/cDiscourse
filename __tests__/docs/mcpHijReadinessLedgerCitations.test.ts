/**
 * DEVEX-DOC-GUARD-TESTS-001 (#496) — Test 2
 *
 * Guards the citations in `docs/core/MCP-HIJ-READINESS-LEDGER.md`. Every
 * `file:line` cite in the ledger must resolve to a real file with at least that
 * many lines, and the load-bearing cites must still point at the registry
 * lines they claim. This catches citation drift in CI rather than
 * re-verifying by hand each time HEAD advances.
 *
 * MCP-H-002 (2026-06-10, operator-approved at E#7(b) after the #472
 * reproduction PASS): Family H (`claim_clarity`) was re-enabled to
 * `productionEnabled: true` — the realization of the ledger's own named flip
 * precondition (Row H, col 10: "satisfy E#7 + a clean Card-3 re-run smoke,
 * owned by #472"). The frozen set narrowed from {H, I, J} to {I, J}.
 *
 * MCP-I-D2 (2026-06-10, operator-authorized MCP-021C-EDGE-FAMILY-I-ENABLE
 * per the D1 runbook): Family I (`thread_topology`) was re-enabled to
 * `productionEnabled: true` — the realization of Row I's named precondition
 * (Cards 1/2 shipped + the mixed-source subset entry present + H stable). The
 * frozen set therefore narrowed from {I, J} to {J}. This is NOT a loosening:
 * the freeze guard is preserved verbatim for the still-frozen J, and a NEW
 * guard locks I at `productionEnabled: true` (catches an accidental re-freeze
 * of I), mirroring the H guard.
 *
 * Doctrine: cdiscourse-doctrine §4-C (never-self-approve) — the load-bearing
 * cites prove the frozen J family stays `productionEnabled: false` and that
 * the now-thawed H + I stay `productionEnabled: true` (no silent flip in
 * either direction).
 *
 * §4-A failure semantics: if a cite fails, the doc's citation has drifted OR a
 * cited file moved. Do NOT loosen the test and do NOT edit the guarded doc.
 * Report the failing cite + the actual file state and HALT. (The MCP-H-002
 * re-baseline above is the operator-approved exception, not a self-approval:
 * the flip is authorized by E#7(b) and the guard is strengthened, not
 * weakened.)
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LEDGER_REL = 'docs/core/MCP-HIJ-READINESS-LEDGER.md';
const LEDGER_ABS = path.join(REPO_ROOT, LEDGER_REL);

/**
 * The ledger cites some files by bare filename (e.g. `familyRegistry.ts:106`)
 * and others by full repo-relative path. Resolve bare filenames to their
 * canonical repo-relative path. The Edge registry — not the mcp-server twin —
 * is the one whose 106/111/116 lines the ledger's load-bearing cites refer to
 * (the ledger explicitly cites
 * `supabase/functions/_shared/booleanObservations/familyRegistry.ts:68-119`).
 */
const BARE_FILENAME_RESOLUTIONS: Record<string, string> = {
  'familyRegistry.ts':
    'supabase/functions/_shared/booleanObservations/familyRegistry.ts',
  'booleanObservationRequestBuilder.ts':
    'supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts',
  'classifierQueueRouting.ts':
    'supabase/functions/_shared/booleanObservations/classifierQueueRouting.ts',
  'known-blockers.md': 'docs/core/known-blockers.md',
  'OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md':
    'docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md',
};

interface Cite {
  raw: string;
  citedPath: string; // exactly as written in the ledger
  resolvedRel: string; // repo-relative path we resolve it to
  line: number; // the FIRST line number in the cite (e.g. 106 from `:106-107`)
}

/**
 * Parse backtick-wrapped `path:line` / `path:line-line` / `path:line,line`
 * cites. Captures the path (ending .ts or .md) and the first line number.
 */
const CITE_RE = /`([^`]*?\.(?:ts|md)):(\d+)(?:[-,]\d+)*`/g;

function resolveCitedPath(citedPath: string): string {
  if (citedPath.includes('/')) {
    // Full repo-relative path used verbatim.
    return citedPath;
  }
  const mapped = BARE_FILENAME_RESOLUTIONS[citedPath];
  if (mapped) {
    return mapped;
  }
  // Unknown bare filename — return as-is so the existence check fails loudly
  // (a NEW bare-filename cite the resolver does not know about is a defect to
  // surface, not silently pass).
  return citedPath;
}

function parseCites(text: string): Cite[] {
  const cites: Cite[] = [];
  let m: RegExpExecArray | null;
  while ((m = CITE_RE.exec(text)) !== null) {
    const citedPath = m[1];
    cites.push({
      raw: m[0],
      citedPath,
      resolvedRel: resolveCitedPath(citedPath),
      line: parseInt(m[2], 10),
    });
  }
  return cites;
}

describe('MCP-HIJ readiness ledger — citation integrity', () => {
  let text: string;
  let cites: Cite[];

  beforeAll(() => {
    expect(fs.existsSync(LEDGER_ABS)).toBe(true);
    text = fs.readFileSync(LEDGER_ABS, 'utf8');
    cites = parseCites(text);
  });

  describe('1. cite parsing captures the load-bearing registry cites', () => {
    it('captures familyRegistry.ts:106/111/116 + 68/69', () => {
      const regLines = cites
        .filter((c) => c.citedPath === 'familyRegistry.ts')
        .map((c) => c.line);
      // The ledger cites the Edge registry by bare name; ensure the
      // load-bearing cites are present: 106 (H — production-enabled per
      // MCP-H-002) + 111 (I — production-enabled per MCP-I-D2) + 116 (J —
      // still frozen) + the freeze/first-entry cites.
      for (const expected of [106, 111, 116]) {
        expect(regLines).toContain(expected);
      }
      // 68 (Object.freeze) / 69 (first entry) are cited as the full path or the
      // bare name; assert at least one of {68, 69} appears across either form.
      const fullRegLines = cites
        .filter(
          (c) =>
            c.resolvedRel ===
            'supabase/functions/_shared/booleanObservations/familyRegistry.ts',
        )
        .map((c) => c.line);
      const has68or69 = [68, 69].some((n) => fullRegLines.includes(n));
      expect(has68or69).toBe(true);
    });

    it('parses a non-trivial number of cites', () => {
      expect(cites.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('2. every cited file exists', () => {
    it('resolves all cited paths to existing files', () => {
      const missing: string[] = [];
      for (const c of cites) {
        const abs = path.join(REPO_ROOT, c.resolvedRel);
        if (!fs.existsSync(abs)) {
          const lineNum = text.indexOf(c.raw) >= 0
            ? text.slice(0, text.indexOf(c.raw)).split('\n').length
            : 0;
          missing.push(
            `${LEDGER_REL}:${lineNum} cites ${c.raw} → resolved ` +
              `"${c.resolvedRel}" which does not exist`,
          );
        }
      }
      if (missing.length) {
        throw new Error('Missing cited files:\n' + missing.join('\n'));
      }
      expect(missing).toEqual([]);
    });
  });

  describe('3. every cite line is in range of the cited file', () => {
    it('each cited file has at least the cited line number of lines', () => {
      const outOfRange: string[] = [];
      // Cache line counts per resolved path.
      const lineCounts = new Map<string, number>();
      for (const c of cites) {
        const abs = path.join(REPO_ROOT, c.resolvedRel);
        if (!fs.existsSync(abs)) {
          continue; // existence is asserted separately
        }
        let count = lineCounts.get(c.resolvedRel);
        if (count === undefined) {
          count = fs.readFileSync(abs, 'utf8').split('\n').length;
          lineCounts.set(c.resolvedRel, count);
        }
        if (c.line > count) {
          outOfRange.push(
            `${c.raw} → "${c.resolvedRel}" has only ${count} lines ` +
              `(< cited ${c.line})`,
          );
        }
      }
      if (outOfRange.length) {
        throw new Error('Out-of-range cites:\n' + outOfRange.join('\n'));
      }
      expect(outOfRange).toEqual([]);
    });
  });

  describe('4. load-bearing cites: frozen J productionEnabled:false, thawed H+I productionEnabled:true (post MCP-H-002 + MCP-I-D2)', () => {
    const EDGE_REGISTRY =
      'supabase/functions/_shared/booleanObservations/familyRegistry.ts';

    let registryLines: string[];
    beforeAll(() => {
      registryLines = fs
        .readFileSync(path.join(REPO_ROOT, EDGE_REGISTRY), 'utf8')
        .split('\n');
    });

    // The still-frozen set is J only. (H was re-enabled by MCP-H-002 / E#7(b);
    // I was re-enabled by MCP-021C-EDGE-FAMILY-I-ENABLE / MCP-I-D2; their
    // productionEnabled:true guards are the separate assertions below.)
    const LOAD_BEARING_FROZEN: Array<{ family: string; line: number; nameLine: number }> = [
      { family: 'sensitive_composer', line: 116, nameLine: 115 },
    ];

    for (const { family, line, nameLine } of LOAD_BEARING_FROZEN) {
      it(`${EDGE_REGISTRY}:${line} (${family}) is productionEnabled: false`, () => {
        // 1-indexed cite → 0-indexed array.
        const content = registryLines[line - 1];
        expect(content).toBeDefined();
        expect(content).toContain('productionEnabled: false');
        // The family name sits on the line just above; confirm the cite anchors
        // to the right family (drift-detection: a registry reorder would move
        // the name away from this line).
        const nameContent = registryLines[nameLine - 1];
        expect(nameContent).toContain(`'${family}'`);
      });
    }

    it(`${EDGE_REGISTRY}:106 (claim_clarity) is productionEnabled: true (re-enabled by MCP-H-002 / E#7(b))`, () => {
      // Drift-detection for the thaw: catches an accidental re-freeze of H.
      // 1-indexed cite → 0-indexed array.
      const content = registryLines[106 - 1];
      expect(content).toBeDefined();
      expect(content).toContain('productionEnabled: true');
      const nameContent = registryLines[105 - 1];
      expect(nameContent).toContain(`'claim_clarity'`);
    });

    it(`${EDGE_REGISTRY}:111 (thread_topology) is productionEnabled: true (re-enabled by MCP-021C-EDGE-FAMILY-I-ENABLE / MCP-I-D2)`, () => {
      // Drift-detection for the I thaw: catches an accidental re-freeze of I.
      // Mirrors the H guard above. 1-indexed cite → 0-indexed array.
      const content = registryLines[111 - 1];
      expect(content).toBeDefined();
      expect(content).toContain('productionEnabled: true');
      const nameContent = registryLines[110 - 1];
      expect(nameContent).toContain(`'thread_topology'`);
    });

    it('the ledger itself cites all three load-bearing lines', () => {
      const regLines = cites
        .filter((c) => c.citedPath === 'familyRegistry.ts')
        .map((c) => c.line);
      expect(regLines).toEqual(expect.arrayContaining([106, 111, 116]));
    });
  });
});
