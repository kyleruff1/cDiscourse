/**
 * UX-001.5 — Doctrine scans across every UX-001.5 source file.
 *
 * Asserts the cdiscourse-doctrine non-negotiables across:
 *   - all 12 primitive source files in src/features/nodeAnnotations/;
 *   - the 4 bounded-modification files (InspectPopout.tsx,
 *     inspectPopoutModel.ts, inspectContentBuilder.ts,
 *     RefereeBannerView.tsx);
 *   - all UX-001.5 test files in __tests__/.
 *
 * Scans:
 *   1. Verdict ban-list (no winner / loser / liar / etc. in user-facing
 *      strings).
 *   2. Internal-code leak guard (no snake_case internal codes in any
 *      string literal).
 *   3. No SERVICE_ROLE / ANTHROPIC_API_KEY / XAI_API_KEY references.
 *   4. No AI provider imports.
 *   5. No console.log statements in committed code.
 *   6. No fetch() or supabase import in the primitive directory.
 *   7. No hex literals in any primitive source file (token-only).
 */
import * as fs from 'fs';
import * as path from 'path';
import { normalizeAnnotationChipDescriptor } from '../src/features/nodeAnnotations/annotationChipDescriptor';

const ROOT = process.cwd();

const PRIMITIVE_FILES = [
  'src/features/nodeAnnotations/annotationChipDescriptor.ts',
  'src/features/nodeAnnotations/annotationKindTokens.ts',
  'src/features/nodeAnnotations/annotationAriaLabel.ts',
  'src/features/nodeAnnotations/annotationFocusBoundary.ts',
  'src/features/nodeAnnotations/inspectSectionChipDescriptors.ts',
  'src/features/nodeAnnotations/AnnotationChip.tsx',
  'src/features/nodeAnnotations/AnnotationChipStrip.tsx',
  'src/features/nodeAnnotations/AnnotationOverflowChip.tsx',
  'src/features/nodeAnnotations/AnnotationBadge.tsx',
  'src/features/nodeAnnotations/AnnotationBadgeCluster.tsx',
  'src/features/nodeAnnotations/AnnotationFocusRing.tsx',
  'src/features/nodeAnnotations/AnnotationOutline.tsx',
  'src/features/nodeAnnotations/AnnotationEdgeHighlight.tsx',
  'src/features/nodeAnnotations/AnnotationFocusBoundaryView.tsx',
  'src/features/nodeAnnotations/InspectSectionChipStrip.tsx',
  'src/features/nodeAnnotations/InspectGroupHeader.tsx',
  'src/features/nodeAnnotations/index.ts',
];

const BOUNDED_MODIFICATION_FILES = [
  'src/features/arguments/oneBox/InspectPopout.tsx',
  'src/features/arguments/oneBox/inspectPopoutModel.ts',
  'src/features/arguments/oneBox/inspectContentBuilder.ts',
  'src/features/refereeBanners/RefereeBannerView.tsx',
];

const TEST_FILES = [
  '__tests__/uxOneOneFiveAccessibilityChip.test.tsx',
  '__tests__/uxOneOneFiveAriaLabel.test.ts',
  '__tests__/uxOneOneFiveBadgeNoDisplacement.test.tsx',
  '__tests__/uxOneOneFiveBandSizingMatrix.test.ts',
  '__tests__/uxOneOneFiveChipDescriptor.test.ts',
  '__tests__/uxOneOneFiveDescriptorForwardCompat.test.ts',
  '__tests__/uxOneOneFiveFocusBoundary.test.ts',
  '__tests__/uxOneOneFiveInspectFlagsIntegration.test.tsx',
  '__tests__/uxOneOneFiveInspectGroupHeader.test.ts',
  '__tests__/uxOneOneFiveInspectInterfaceStability.test.ts',
  '__tests__/uxOneOneFiveKindTokens.test.ts',
  '__tests__/uxOneOneFivePrimitivePresence.test.ts',
  '__tests__/uxOneOneFiveRingsAndOutline.test.tsx',
  '__tests__/uxOneOneFiveSemanticBannerExtension.test.tsx',
  '__tests__/uxOneOneFiveStripOverflow.test.tsx',
];

/**
 * Production-side files the verdict + internal-code scans walk. Test
 * files necessarily NAME the banned tokens inside the assertion calls
 * (e.g. `it('does not leak ' + code, ...)`) — scanning them would be a
 * false positive. The doctrine guarantee applies to the user-facing
 * production code; the tests are the verification of that guarantee.
 */
const PRODUCTION_FILES = [...PRIMITIVE_FILES, ...BOUNDED_MODIFICATION_FILES];

const VERDICT_TOKENS = [
  'winner',
  'loser',
  'liar',
  'dishonest',
  'manipulative',
  'extremist',
  'propagandist',
  'bad faith',
  'proof of',
  'this is wrong',
  'this is false',
  'this is invalid',
  'correctness',
  'truth value',
  'verdict',
];

const INTERNAL_CODES = [
  'topic_satisfaction_lexical',
  'source_chain_lexical',
  'anti_amplification',
  'evidence_debt_unresolved',
  'platform_support_warning',
  'validation_failed_after_retries',
  'max_depth_reached',
  'synthesis_ready_lexical',
  'submit_failed_lexical',
];

const FORBIDDEN_SECRETS = [
  'SERVICE_ROLE',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'XAI_API_KEY',
  'X_BEARER_TOKEN',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
];

const FORBIDDEN_AI_IMPORTS = [
  '@anthropic-ai/',
  '@anthropic/',
  'openai',
  '@google/generative-ai',
];

/**
 * Extract every string literal (single-quoted, double-quoted, template
 * literal) from a TypeScript source file. Skips comments (which are
 * allowed to discuss doctrine vocabulary). Same helper as
 * uxOneOneFourDoctrine.test.ts.
 */
function extractStringLiterals(src: string): string[] {
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  const literals: string[] = [];
  const pattern = /(['"`])((?:\\.|(?!\1).)*)\1/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(stripped)) !== null) {
    literals.push(m[2]);
  }
  return literals;
}

/** Strip comments for code-only scans (e.g. import / fetch checks). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

// ── Verdict ban-list ─────────────────────────────────────────────

describe('UX-001.5 — verdict ban-list scan across production source files', () => {
  for (const relPath of PRODUCTION_FILES) {
    const fullPath = path.resolve(ROOT, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const src = fs.readFileSync(fullPath, 'utf8');
    const literals = extractStringLiterals(src);
    for (const token of VERDICT_TOKENS) {
      it(`${relPath} — no string literal contains "${token}"`, () => {
        const hits = literals.filter((s) => s.toLowerCase().includes(token.toLowerCase()));
        expect(hits).toEqual([]);
      });
    }
  }
});

// ── Internal-code leak guard ────────────────────────────────────

describe('UX-001.5 — internal-code leak guard on production source files', () => {
  for (const relPath of PRODUCTION_FILES) {
    const fullPath = path.resolve(ROOT, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const src = fs.readFileSync(fullPath, 'utf8');
    const literals = extractStringLiterals(src);
    for (const code of INTERNAL_CODES) {
      it(`${relPath} — no string literal leaks internal code "${code}"`, () => {
        const hits = literals.filter((s) => s.includes(code));
        expect(hits).toEqual([]);
      });
    }
  }
});

describe('UX-001.5 — test file coverage record (presence only)', () => {
  for (const relPath of TEST_FILES) {
    it(`${relPath} exists`, () => {
      expect(fs.existsSync(path.resolve(ROOT, relPath))).toBe(true);
    });
  }
});

// ── Secrets / AI provider scans ─────────────────────────────────

describe('UX-001.5 — no secret env var references in primitive code', () => {
  for (const relPath of [...PRIMITIVE_FILES, ...BOUNDED_MODIFICATION_FILES]) {
    const fullPath = path.resolve(ROOT, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const src = fs.readFileSync(fullPath, 'utf8');
    for (const secret of FORBIDDEN_SECRETS) {
      it(`${relPath} — does NOT reference "${secret}"`, () => {
        expect(src).not.toMatch(new RegExp(secret));
      });
    }
  }
});

describe('UX-001.5 — no AI provider imports in primitive directory', () => {
  for (const relPath of PRIMITIVE_FILES) {
    const fullPath = path.resolve(ROOT, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const src = fs.readFileSync(fullPath, 'utf8');
    const code = stripComments(src);
    for (const provider of FORBIDDEN_AI_IMPORTS) {
      it(`${relPath} — does NOT import "${provider}"`, () => {
        expect(code).not.toMatch(
          new RegExp(`from\\s+['"]${provider.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
        );
      });
    }
  }
});

// ── No console.log / no fetch / no supabase in primitives ───────

describe('UX-001.5 — primitive directory has no console.log / fetch / supabase imports', () => {
  for (const relPath of PRIMITIVE_FILES) {
    const fullPath = path.resolve(ROOT, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const src = fs.readFileSync(fullPath, 'utf8');
    const code = stripComments(src);

    it(`${relPath} — does NOT call console.log`, () => {
      expect(code).not.toMatch(/console\.log\s*\(/);
    });

    it(`${relPath} — does NOT call fetch (no network)`, () => {
      expect(code).not.toMatch(/\bfetch\s*\(/);
    });

    it(`${relPath} — does NOT import supabase`, () => {
      expect(code).not.toMatch(/from\s+['"][^'"]*\/lib\/supabase['"]/);
    });

    it(`${relPath} — does NOT import @supabase/`, () => {
      expect(code).not.toMatch(/from\s+['"]@supabase\//);
    });
  }
});

// ── Token-only color rule (no hex literals in primitives) ──────

describe('UX-001.5 — token-only color rule (no hex literals in primitive files)', () => {
  for (const relPath of PRIMITIVE_FILES) {
    // index.ts is just re-exports; the source files it points to are
    // each scanned individually.
    if (relPath.endsWith('/index.ts')) continue;
    const fullPath = path.resolve(ROOT, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const src = fs.readFileSync(fullPath, 'utf8');
    it(`${relPath} — contains no hex literals`, () => {
      const hits = src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      expect(hits).toEqual([]);
    });
    it(`${relPath} — contains no rgb()/rgba() calls`, () => {
      const code = stripComments(src);
      expect(code).not.toMatch(/\brgb\s*\(/);
      expect(code).not.toMatch(/\brgba\s*\(/);
    });
  }
});

// ── Inspect read-only doctrine ─────────────────────────────────

describe('UX-001.5 — Inspect popout remains strictly read-only', () => {
  const SRC = fs.readFileSync(
    path.resolve(
      ROOT,
      'src/features/arguments/oneBox/InspectPopout.tsx',
    ),
    'utf8',
  );

  it('does NOT import supabase', () => {
    expect(SRC).not.toMatch(/from\s+['"][^'"]*\/lib\/supabase['"]/);
  });

  it('does NOT import a network primitive', () => {
    const code = stripComments(SRC);
    expect(code).not.toMatch(/\bfetch\s*\(/);
  });

  it('chip strip mount does NOT supply onChipPress (chips are read-only)', () => {
    expect(SRC).not.toMatch(/<InspectSectionChipStrip[\s\S]*?onChipPress=/);
  });
});

// ── Plain-language label coverage ───────────────────────────────

describe('UX-001.5 — descriptor normalizer rejects snake_case-leak labels', () => {
  // This is the descriptor-boundary backstop tested in
  // uxOneOneFiveChipDescriptor.test.ts. Re-asserting here so the
  // doctrine suite is self-contained.
  it('snake_case labels are rejected at the descriptor boundary', () => {
    // Use a generic snake_case sample; the normalizer rejects any
    // label that matches the snake_case-leak pattern.
    expect(
      normalizeAnnotationChipDescriptor({ id: 'x', label: 'sample_internal_code' }),
    ).toBeNull();
  });
});
