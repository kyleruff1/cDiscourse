/**
 * FEEDBACK-001 (#898) — the anti-amplification boundary pin (THE headline doctrine
 * anchor; a failure here is a Block, not a nit).
 *
 * A move-mark is inert HUMAN signal: it may feed the mediator projection + heat,
 * but a count of marks NEVER grants a claim factual standing (point-standing-economy
 * / antiAmplification). This suite pins both halves of the boundary:
 *   1. Source-scan: NO file under src/features/feedback/ value-imports a
 *      pointStanding / antiAmplification / standing-engine path (the
 *      metadataForbiddenImports template). Type-only imports would be OK; none
 *      exist here either.
 *   2. Behavioral: the aggregate output shape carries NO score / standing / weight
 *      / delta field, and the mark-move success response is only viewerMarks
 *      booleans (no count / score) — a pile of did_not_address marks can never
 *      lower a claim's standing.
 */
import * as fs from 'fs';
import * as path from 'path';
import { deriveMoveMarkAggregate } from '../src/features/feedback/moveMarkAggregateModel';
import { summarizeViewerMarks, ALL_MOVE_MARK_CODES } from '../src/features/feedback/moveMarksModel';

const FEEDBACK_DIR = path.join(__dirname, '..', 'src', 'features', 'feedback');
const FEEDBACK_FILES = [
  'moveMarksModel.ts',
  'moveMarkAggregateModel.ts',
  'moveMarksCopy.ts',
  'moveMarksApi.ts',
  'BooleanFeedbackBar.tsx',
  'useMoveMarks.ts',
  'index.ts',
];

function readSrc(file: string): string {
  return fs.readFileSync(path.join(FEEDBACK_DIR, file), 'utf8');
}

/** Value-import lines only (NOT `import type`). */
function valueImportLines(src: string): string {
  const lines = src.split(/\r?\n/);
  const out: string[] = [];
  let inImport = false;
  let isTypeOnly = false;
  let buf: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inImport) {
      if (/^import\s+type\b/.test(trimmed)) {
        if (!/;\s*$/.test(trimmed)) {
          inImport = true;
          isTypeOnly = true;
          buf = [trimmed];
        }
      } else if (/^import\s+/.test(trimmed)) {
        inImport = true;
        isTypeOnly = false;
        buf = [trimmed];
        if (/;\s*$/.test(trimmed)) {
          if (!isTypeOnly) out.push(buf.join(' '));
          inImport = false;
          buf = [];
        }
      }
    } else {
      buf.push(trimmed);
      if (/;\s*$/.test(trimmed)) {
        if (!isTypeOnly) out.push(buf.join(' '));
        inImport = false;
        buf = [];
      }
    }
  }
  return out.join('\n');
}

describe('FEEDBACK-001 — no feedback file value-imports a standing path', () => {
  for (const file of FEEDBACK_FILES) {
    describe(file, () => {
      const imports = valueImportLines(readSrc(file));

      it('does not value-import pointStanding / antiAmplification', () => {
        expect(imports).not.toMatch(/pointStanding/i);
        expect(imports).not.toMatch(/antiAmplification/i);
      });

      it('does not import the standing-engine functions (gradeChallenge / gradeRepair / applyAntiAmplification)', () => {
        expect(imports).not.toMatch(/gradeChallenge|gradeRepair|applyAntiAmplification/);
      });

      it('references no ANTHROPIC_API_KEY / XAI_API_KEY / SERVICE_ROLE', () => {
        const src = readSrc(file);
        expect(src).not.toContain('ANTHROPIC_API_KEY');
        expect(src).not.toContain('XAI_API_KEY');
        expect(src).not.toContain('SERVICE_ROLE');
      });

      it('contains no console.log', () => {
        expect(/\bconsole\.log\s*\(/.test(readSrc(file))).toBe(false);
      });
    });
  }

  it('NEGATIVE CONTROL: the scan would fire on a planted standing import', () => {
    const planted = "import { gradeChallenge } from '../pointStanding/pointStandingEngine';";
    expect(/gradeChallenge/.test(planted)).toBe(true);
    expect(/pointStanding/i.test(planted)).toBe(true);
  });
});

describe('FEEDBACK-001 — behavioral: the mark surfaces carry NO score / standing field', () => {
  it('the aggregate output has only id-lists + a count map (no score / standing / weight / delta)', () => {
    const agg = deriveMoveMarkAggregate([
      { argumentId: 'm1', markCode: 'did_not_address', markedBy: 'a', retractedAt: null },
    ]) as unknown as Record<string, unknown>;
    expect(Object.keys(agg).sort()).toEqual([
      'offThePointMoveIds',
      'receiptsRequestedByArgumentId',
      'unaddressedMoveIds',
    ]);
    for (const key of Object.keys(agg)) {
      expect(key).not.toMatch(/score|standing|weight|delta/i);
    }
  });

  it('the viewer state shape is only the five boolean codes (no score / standing)', () => {
    const state = summarizeViewerMarks(
      [{ argumentId: 'm1', markCode: 'addressed_my_point', markedBy: 'v', retractedAt: null }],
      'm1',
      'v',
    ) as unknown as Record<string, unknown>;
    expect(Object.keys(state).sort()).toEqual([...ALL_MOVE_MARK_CODES].sort());
    for (const value of Object.values(state)) {
      expect(typeof value).toBe('boolean');
    }
  });

  it('the mark-move Edge response builds only viewerMarks booleans (no count) — pinned in the Edge source', () => {
    const edgeSrc = fs.readFileSync(
      path.join(__dirname, '..', 'supabase', 'functions', 'mark-move', 'index.ts'),
      'utf8',
    );
    expect(edgeSrc).toMatch(/return ok\(\{ ok: true, argumentId: body\.argumentId, viewerMarks \}\)/);
    expect(edgeSrc).not.toMatch(/\bcount:/);
    expect(edgeSrc).not.toMatch(/broadStanding|narrowStanding|pointStandingDelta/);
  });
});
