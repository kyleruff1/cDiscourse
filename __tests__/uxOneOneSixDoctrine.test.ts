/**
 * UX-001.6 — Doctrine ban-list scans across every UX-001.{1-5}
 * source file.
 *
 * Per `docs/designs/UX-001.6.md` §5 + `cdiscourse-doctrine` §1, §9,
 * §6, §7, §10a. The scan is patterned on
 * `uxOneOneFiveDoctrine.test.ts` and extends it to the full UX-001
 * source surface.
 *
 * Five scans:
 *   1. Verdict ban-list — no winner / loser / liar / etc. in string
 *      literals.
 *   2. Internal-code ban-list — no raw classifier IDs in string
 *      literals.
 *   3. Service-role ban-list — no SERVICE_ROLE / ANTHROPIC_API_KEY /
 *      XAI_API_KEY references anywhere in `src/` or `app/`.
 *   4. AI-import ban-list — no Anthropic / openai / xAI / Gemini
 *      imports in `src/` or `app/`.
 *   5. Observations / Allegations doctrine — `source` field values
 *      restricted to `'machine'` | `'user'`; sensitive observation
 *      codes only mounted through RefereeBannerView's
 *      observationChips composer-only prop.
 *
 * Scans run viewport-agnostic (the doctrine assertion does not depend
 * on screen size).
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = process.cwd();

/**
 * UX-001 source files in scope. Listed explicitly so the coverage
 * matrix is auditable; a new UX-001 surface file added without
 * extending this list will be caught by the read-only boundary
 * verification (the diff would surface it).
 */
const UX_001_SOURCE_FILES: ReadonlyArray<string> = Object.freeze([
  // UX-001.1 (brand + app shell)
  'src/components/AppHeader.tsx',
  'src/components/AppHeaderTagline.tsx',
  'src/hooks/useHeaderBreakpoint.ts',
  'src/lib/designTokens.ts',
  // UX-001.2 (Timeline + room chrome)
  'src/features/arguments/ArgumentTimelineMap.tsx',
  'src/features/arguments/ArgumentScoreTracker.tsx',
  'src/features/arguments/ArgumentGameSurface.tsx',
  'src/features/arguments/TimelineSelectedReadoutPanel.tsx',
  'src/features/arguments/timelineViewportLayoutModel.ts',
  'src/features/arguments/argumentGameSurfaceModel.ts',
  'src/features/debates/DebateDetailHeader.tsx',
  'App.tsx',
  // UX-001.3 (composer)
  'src/features/arguments/composer/CollapsedComposerStrip.tsx',
  'src/features/arguments/composer/ComposerContextStrip.tsx',
  'src/features/arguments/composer/composerActingOnModel.ts',
  'src/features/arguments/composer/composerDraftRegistry.ts',
  'src/features/arguments/composer/composerHaptics.ts',
  'src/features/arguments/composer/composerKeyboardModel.ts',
  'src/features/arguments/composer/useComposerDraftRegistry.ts',
  'src/features/arguments/composer/useComposerFocusContext.ts',
  'src/features/arguments/ArgumentComposer.tsx',
  'src/features/arguments/ArgumentComposerDock.tsx',
  // UX-001.4 (menu chassis)
  'src/features/arguments/oneBox/Popout.tsx',
  'src/features/arguments/oneBox/PopoutEntry.tsx',
  'src/features/arguments/oneBox/PopoutGroup.tsx',
  'src/features/arguments/oneBox/ActPopout.tsx',
  'src/features/arguments/oneBox/GoPopout.tsx',
  'src/features/arguments/oneBox/InspectPopout.tsx',
  'src/features/arguments/oneBox/actPopoutModel.ts',
  'src/features/arguments/oneBox/goPopoutModel.ts',
  'src/features/arguments/oneBox/inspectPopoutModel.ts',
  'src/features/arguments/oneBox/menuKeyBadgeModel.ts',
  'src/features/arguments/oneBox/menuPresentationModel.ts',
  'src/features/arguments/oneBox/inspectContentBuilder.ts',
  'src/features/arguments/oneBox/OneBox.tsx',
  'src/features/arguments/boardMenuKeyboardModel.ts',
  // UX-001.5 (annotation primitives)
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
  'src/features/refereeBanners/RefereeBannerView.tsx',
  'src/features/evidence/EvidenceAnnotationChip.tsx',
]);

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
 * Sensitive observation codes that may only render via
 * `RefereeBannerView`'s composer-only `observationChips` prop. The
 * scan asserts that no other surface file mounts these codes in a
 * board-level annotation context (the literal source-side mount of
 * the codes — not their occurrence as type-system values).
 */
const SENSITIVE_OBSERVATION_CODES = [
  'shifts_to_person_or_intent',
  'contains_unplayable_insult_only',
  'needs_pre_send_pause',
];

/**
 * Extract every string literal from a TypeScript source file. Skips
 * comments. Same helper as `uxOneOneFiveDoctrine.test.ts`.
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

/** Strip comments for code-only scans. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function readIfExists(relPath: string): string | null {
  const full = path.resolve(ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

const FILE_CACHE: Record<string, string | null> = Object.fromEntries(
  UX_001_SOURCE_FILES.map((f) => [f, readIfExists(f)]),
);

// ── File presence ────────────────────────────────────────────────

describe('UX-001.6 doctrine — every enumerated UX-001 source file exists', () => {
  for (const relPath of UX_001_SOURCE_FILES) {
    it(`${relPath} exists`, () => {
      expect(FILE_CACHE[relPath]).not.toBeNull();
    });
  }
});

// ── Verdict ban-list ─────────────────────────────────────────────

/**
 * Files that legitimately declare the verdict ban-list itself — these
 * arrays ARE the doctrine enforcement (their literals are the values
 * downstream code refuses to ship). The scan exempts them from the
 * verdict scan because the literals are doctrine declarations, not
 * doctrine violations.
 */
const VERDICT_BAN_LIST_DECLARING_FILES = new Set<string>([
  'src/lib/designTokens.ts',
  'src/features/arguments/argumentGameSurfaceModel.ts',
]);

describe('UX-001.6 doctrine — verdict ban-list scan across UX-001 source files', () => {
  for (const relPath of UX_001_SOURCE_FILES) {
    const src = FILE_CACHE[relPath];
    if (!src) continue;
    if (VERDICT_BAN_LIST_DECLARING_FILES.has(relPath)) continue;
    const literals = extractStringLiterals(src);
    for (const token of VERDICT_TOKENS) {
      it(`${relPath} — no string literal contains "${token}"`, () => {
        const hits = literals.filter((s) =>
          s.toLowerCase().includes(token.toLowerCase()),
        );
        expect(hits).toEqual([]);
      });
    }
  }
});

describe('UX-001.6 doctrine — files that declare the verdict ban-list expose it as a list of literals', () => {
  for (const relPath of VERDICT_BAN_LIST_DECLARING_FILES) {
    it(`${relPath} declares verdict tokens only inside a ban-list export`, () => {
      const src = FILE_CACHE[relPath];
      expect(src).not.toBeNull();
      if (!src) return;
      // The literal "winner" / "loser" etc. must appear ONLY inside an
      // explicit ban-list declaration (FORBIDDEN_*, BANNED_*). We
      // verify by extracting the literals and confirming each verdict
      // hit is preceded (within a 16-line window) by a const/array
      // pattern that names a forbidden / banned list. A more rigorous
      // structural check would require an AST parse; the line-based
      // assertion is sufficient because the existing code uses this
      // canonical pattern.
      const lines = src.split('\n');
      for (const token of VERDICT_TOKENS) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line.toLowerCase().includes(token.toLowerCase())) continue;
          // Find the nearest preceding declaration; allow comments
          // and array-element lines.
          let foundDecl = false;
          for (let j = i; j >= Math.max(0, i - 16); j--) {
            if (/FORBIDDEN_|BANNED_/.test(lines[j])) {
              foundDecl = true;
              break;
            }
          }
          // Also allow doctrine-commentary mentions in a comment block.
          if (!foundDecl && /^\s*\*/.test(line)) {
            foundDecl = true;
          }
          if (!foundDecl && /^\s*\/\//.test(line)) {
            foundDecl = true;
          }
          expect(foundDecl).toBe(true);
        }
      }
    });
  }
});

// ── Internal-code leak guard ────────────────────────────────────

describe('UX-001.6 doctrine — internal-code leak guard across UX-001 source files', () => {
  for (const relPath of UX_001_SOURCE_FILES) {
    const src = FILE_CACHE[relPath];
    if (!src) continue;
    const literals = extractStringLiterals(src);
    for (const code of INTERNAL_CODES) {
      it(`${relPath} — no string literal leaks internal code "${code}"`, () => {
        const hits = literals.filter((s) => s.includes(code));
        expect(hits).toEqual([]);
      });
    }
  }
});

// ── Secrets ban-list ────────────────────────────────────────────

describe('UX-001.6 doctrine — no secret env var references in UX-001 source files', () => {
  for (const relPath of UX_001_SOURCE_FILES) {
    const src = FILE_CACHE[relPath];
    if (!src) continue;
    for (const secret of FORBIDDEN_SECRETS) {
      it(`${relPath} — does NOT reference "${secret}"`, () => {
        expect(src).not.toMatch(new RegExp(secret));
      });
    }
  }
});

// ── AI-import ban-list ──────────────────────────────────────────

describe('UX-001.6 doctrine — no AI provider imports in UX-001 source files', () => {
  for (const relPath of UX_001_SOURCE_FILES) {
    const src = FILE_CACHE[relPath];
    if (!src) continue;
    const code = stripComments(src);
    for (const provider of FORBIDDEN_AI_IMPORTS) {
      it(`${relPath} — does NOT import "${provider}"`, () => {
        expect(code).not.toMatch(
          new RegExp(
            `from\\s+['"]${provider.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
          ),
        );
      });
    }
  }
});

// ── App + src global scans (no SERVICE_ROLE / AI provider) ──────

describe('UX-001.6 doctrine — no SERVICE_ROLE references anywhere in src/ or app/', () => {
  const filesScanned: string[] = [];
  walkDir(path.resolve(ROOT, 'src'), filesScanned, ['.ts', '.tsx']);
  if (fs.existsSync(path.resolve(ROOT, 'app'))) {
    walkDir(path.resolve(ROOT, 'app'), filesScanned, ['.ts', '.tsx']);
  }
  // App.tsx at the repo root counts as application code too.
  const appTsx = path.resolve(ROOT, 'App.tsx');
  if (fs.existsSync(appTsx)) filesScanned.push(appTsx);

  it('no client source file references SUPABASE_SERVICE_ROLE_KEY', () => {
    const offenders: string[] = [];
    for (const file of filesScanned) {
      const content = fs.readFileSync(file, 'utf8');
      if (/SUPABASE_SERVICE_ROLE_KEY/.test(content)) {
        offenders.push(path.relative(ROOT, file).replace(/\\/g, '/'));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no client source file references a bare SERVICE_ROLE token', () => {
    const offenders: string[] = [];
    for (const file of filesScanned) {
      const content = fs.readFileSync(file, 'utf8');
      // Match SERVICE_ROLE only as a complete identifier (not part
      // of a different word like SOME_SERVICE_ROLEY).
      if (/\bSERVICE_ROLE\b/.test(content)) {
        offenders.push(path.relative(ROOT, file).replace(/\\/g, '/'));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('UX-001.6 doctrine — no Anthropic / xAI / openai / Gemini imports in src/ or app/', () => {
  const filesScanned: string[] = [];
  walkDir(path.resolve(ROOT, 'src'), filesScanned, ['.ts', '.tsx']);
  if (fs.existsSync(path.resolve(ROOT, 'app'))) {
    walkDir(path.resolve(ROOT, 'app'), filesScanned, ['.ts', '.tsx']);
  }
  const appTsx = path.resolve(ROOT, 'App.tsx');
  if (fs.existsSync(appTsx)) filesScanned.push(appTsx);

  for (const provider of FORBIDDEN_AI_IMPORTS) {
    it(`no client source file imports "${provider}"`, () => {
      const offenders: string[] = [];
      for (const file of filesScanned) {
        const content = stripComments(fs.readFileSync(file, 'utf8'));
        const importPattern = new RegExp(
          `from\\s+['"]${provider.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        );
        if (importPattern.test(content)) {
          offenders.push(path.relative(ROOT, file).replace(/\\/g, '/'));
        }
      }
      expect(offenders).toEqual([]);
    });
  }
});

// ── Observations / Allegations doctrine ─────────────────────────

describe('UX-001.6 doctrine — AnnotationChipDescriptor source field constrained to "machine" | "user"', () => {
  const DESCRIPTOR_SRC = FILE_CACHE['src/features/nodeAnnotations/annotationChipDescriptor.ts'];

  it('descriptor source declares the source field union', () => {
    expect(DESCRIPTOR_SRC).not.toBeNull();
    if (!DESCRIPTOR_SRC) return;
    // The type lives in this file and is constrained to the doctrine
    // value set. We assert by looking for the literal type definition.
    expect(DESCRIPTOR_SRC).toMatch(/AnnotationChipSource/);
    expect(DESCRIPTOR_SRC).toMatch(/'machine'/);
    expect(DESCRIPTOR_SRC).toMatch(/'user'/);
  });

  it('descriptor source has NO third source-field value beyond machine/user', () => {
    expect(DESCRIPTOR_SRC).not.toBeNull();
    if (!DESCRIPTOR_SRC) return;
    // Extract the ANNOTATION_CHIP_SOURCES const value. The list MUST
    // contain only the two literals. Any third literal is a violation.
    const literals = extractStringLiterals(DESCRIPTOR_SRC);
    const sourceCandidateTokens = new Set(literals);
    // The full literal list contains many unrelated strings; the
    // doctrine check is that 'machine' and 'user' both appear AND no
    // alternate-source-style literal is present in the file. We
    // narrow by checking the verbatim presence of the canonical pair
    // and the absence of obvious alternates.
    expect(sourceCandidateTokens.has('machine')).toBe(true);
    expect(sourceCandidateTokens.has('user')).toBe(true);
    // Banned alternative source values.
    expect(sourceCandidateTokens.has('admin')).toBe(false);
    expect(sourceCandidateTokens.has('referee')).toBe(false);
    expect(sourceCandidateTokens.has('AI')).toBe(false);
    expect(sourceCandidateTokens.has('moderator')).toBe(false);
    expect(sourceCandidateTokens.has('bot')).toBe(false);
  });
});

describe('UX-001.6 doctrine — sensitive observation codes only mount through RefereeBannerView composer-only path', () => {
  for (const code of SENSITIVE_OBSERVATION_CODES) {
    it(`sensitive code "${code}" appears only in composer-context files`, () => {
      const filesScanned: string[] = [];
      walkDir(path.resolve(ROOT, 'src'), filesScanned, ['.ts', '.tsx']);
      // Allow-list of files where the code may appear as a literal
      // (the composer context that mounts the chip via
      // RefereeBannerView's observationChips prop, plus the
      // RefereeBannerView source itself, plus any schema / model
      // that DEFINES the code as an enum value).
      const allowList = [
        'src/features/refereeBanners',
        'src/features/arguments/composer',
        'src/features/arguments/ArgumentComposer',
        'src/features/arguments/ArgumentComposerDock',
        // The type / enum / schema definitions are NOT mounts; they
        // declare the vocabulary the doctrine governs. They appear
        // in semantic-referee model files + the constitution
        // classifier catalog.
        'src/features/semanticReferee',
        'src/features/refereeAnnotations',
        'src/features/arguments/preSend',
        'src/lib/constitution/semanticClassifierCatalog',
      ];
      const offenders: string[] = [];
      for (const file of filesScanned) {
        const rel = path.relative(ROOT, file).replace(/\\/g, '/');
        if (allowList.some((prefix) => rel.startsWith(prefix))) continue;
        const content = fs.readFileSync(file, 'utf8');
        const literals = extractStringLiterals(content);
        if (literals.includes(code)) {
          offenders.push(rel);
        }
      }
      expect(offenders).toEqual([]);
    });
  }
});

// ── Helpers ──────────────────────────────────────────────────────

function walkDir(dir: string, out: string[], extensions: string[]): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, out, extensions);
    } else if (entry.isFile()) {
      if (extensions.some((ext) => entry.name.endsWith(ext))) {
        out.push(full);
      }
    }
  }
}
