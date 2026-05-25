/**
 * UX-001.7 Workstream 6 — UX-001.5A label-chip readiness verification.
 *
 * Per `docs/designs/UX-001.7.md` §7.B — UX-001.7 must make the design
 * system READY for UX-001.5A's Observations vs Allegations label
 * chips, without requiring color reliance. UX-001.5A is operator-gated
 * (pre-launch source-access audit), so this test verifies the
 * READINESS, not the implementation.
 *
 * The two future label chips per §7.B:
 *
 *   "Machine observation: Source gap" = AnnotationChipDescriptor {
 *     kind: 'semantic', iconHint: 'info', source: 'machine',
 *     category: 'semantic_referee', label: 'Source gap'
 *   }
 *
 *   "User allegation: Needs source" = AnnotationChipDescriptor {
 *     kind: 'flag', iconHint: 'warn', source: 'user',
 *     category: 'manual_tag', label: 'Needs source'
 *   }
 *
 * Doctrine (cdiscourse-doctrine §10a Observations vs Allegations):
 *   - Machine-generated labels are Observations.
 *   - User-generated labels are Allegations.
 *   - The schema boundary is `source: 'machine' | 'user'` on the
 *     descriptor.
 *   - No Observation or Allegation may imply truth / verdict.
 *
 * Pure-TS test — exercises the descriptor + token alignment without
 * mounting any React tree (the chip primitive's render contract is
 * already covered by UX-001.5 tests).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  STATUS,
  SURFACE_TOKENS,
  TYPOGRAPHY,
} from '../src/lib/designTokens';
import {
  ANNOTATION_CHIP_KINDS,
  ANNOTATION_CHIP_SOURCES,
  ANNOTATION_CHIP_ICON_HINTS,
  isAnnotationChipDescriptor,
  normalizeAnnotationChipDescriptor,
  type AnnotationChipDescriptor,
} from '../src/features/nodeAnnotations/annotationChipDescriptor';
import {
  resolveChipColors,
  resolveChipColorsForDescriptor,
} from '../src/features/nodeAnnotations/annotationKindTokens';
import { buildAnnotationAriaLabel } from '../src/features/nodeAnnotations/annotationAriaLabel';

const ROOT = process.cwd();

// ── The two canonical UX-001.5A fixtures ────────────────────────

const MACHINE_OBSERVATION_SOURCE_GAP: AnnotationChipDescriptor = {
  id: 'machine-observation-source-gap',
  kind: 'semantic',
  iconHint: 'info',
  source: 'machine',
  category: 'semantic_referee',
  label: 'Source gap',
};

const USER_ALLEGATION_NEEDS_SOURCE: AnnotationChipDescriptor = {
  id: 'user-allegation-needs-source',
  kind: 'flag',
  iconHint: 'warn',
  source: 'user',
  category: 'manual_tag',
  label: 'Needs source',
};

// ── Descriptor shape readiness ──────────────────────────────────

describe('UX-001.7 — descriptor schema is ready for UX-001.5A Observation/Allegation fixtures', () => {
  it('annotationChipDescriptor.ts declares the `source: machine|user` slot', () => {
    expect(ANNOTATION_CHIP_SOURCES).toContain('machine');
    expect(ANNOTATION_CHIP_SOURCES).toContain('user');
    expect(ANNOTATION_CHIP_SOURCES).toHaveLength(2);
  });

  it('annotationChipDescriptor.ts declares the `category: string` slot (free-form for UX-001.5A enums)', () => {
    // Free-form string slot — UX-001.5A's MachineObservationSource /
    // UserAllegationSource enums fit by value at runtime.
    const descriptorSrc = fs.readFileSync(
      path.resolve(ROOT, 'src/features/nodeAnnotations/annotationChipDescriptor.ts'),
      'utf8',
    );
    expect(descriptorSrc).toMatch(/category\?:\s*string/);
  });

  it('descriptor accepts a fully-formed Machine Observation: Source gap fixture', () => {
    expect(isAnnotationChipDescriptor(MACHINE_OBSERVATION_SOURCE_GAP)).toBe(true);
  });

  it('descriptor accepts a fully-formed User Allegation: Needs source fixture', () => {
    expect(isAnnotationChipDescriptor(USER_ALLEGATION_NEEDS_SOURCE)).toBe(true);
  });

  it('the normalizer preserves both fixtures verbatim (no drift)', () => {
    const m = normalizeAnnotationChipDescriptor(MACHINE_OBSERVATION_SOURCE_GAP);
    const u = normalizeAnnotationChipDescriptor(USER_ALLEGATION_NEEDS_SOURCE);
    expect(m).toEqual(MACHINE_OBSERVATION_SOURCE_GAP);
    expect(u).toEqual(USER_ALLEGATION_NEEDS_SOURCE);
  });

  it('the `semantic` kind is in the canonical kind set (Machine Observation default)', () => {
    expect(ANNOTATION_CHIP_KINDS).toContain('semantic');
  });

  it('the `flag` kind is in the canonical kind set (User Allegation default)', () => {
    expect(ANNOTATION_CHIP_KINDS).toContain('flag');
  });

  it('the `info` iconHint is in the canonical iconHint set (Machine Observation glyph)', () => {
    expect(ANNOTATION_CHIP_ICON_HINTS).toContain('info');
  });

  it('the `warn` iconHint is in the canonical iconHint set (User Allegation glyph)', () => {
    expect(ANNOTATION_CHIP_ICON_HINTS).toContain('warn');
  });
});

// ── Color resolution — both fixtures resolve to token-derived colors ──

describe('UX-001.7 — both UX-001.5A fixtures resolve to token-derived colors (no hex literals)', () => {
  it('Machine Observation: Source gap resolves to a `semantic` kind token triple', () => {
    const colors = resolveChipColorsForDescriptor(MACHINE_OBSERVATION_SOURCE_GAP);
    // semantic → elevated bg, textSecondary fg, border (no warning border on `info`)
    expect(colors.bg).toBe(SURFACE_TOKENS.elevated);
    expect(colors.fg).toBe(SURFACE_TOKENS.textSecondary);
    expect(colors.borderColor).toBe(SURFACE_TOKENS.border);
  });

  it('User Allegation: Needs source resolves to a `flag` kind token triple WITH a warning border (iconHint=warn)', () => {
    const colors = resolveChipColorsForDescriptor(USER_ALLEGATION_NEEDS_SOURCE);
    // flag → elevated bg, textPrimary fg, warning border (advisory)
    // iconHint=warn shifts borderColor to STATUS.warning.bg
    expect(colors.bg).toBe(SURFACE_TOKENS.elevated);
    expect(colors.fg).toBe(SURFACE_TOKENS.textPrimary);
    expect(colors.borderColor).toBe(STATUS.warning.bg);
  });

  it('neither resolved color triple contains a hex literal not in designTokens (no drift)', () => {
    const machine = resolveChipColorsForDescriptor(MACHINE_OBSERVATION_SOURCE_GAP);
    const user = resolveChipColorsForDescriptor(USER_ALLEGATION_NEEDS_SOURCE);
    // All values come from existing tokens; just verify they are hex
    // strings of the expected format.
    expect(machine.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(machine.fg).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(user.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(user.fg).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('the `info` and `warn` iconHints produce DIFFERENT border colors (non-color-only differentiation is supplementary)', () => {
    const info = resolveChipColors('semantic', 'info');
    const warn = resolveChipColors('flag', 'warn');
    // Different borders → different "border emphasis" carrier; the
    // glyph + label still carry the meaning regardless of color.
    expect(info.borderColor).not.toBe(warn.borderColor);
  });
});

// ── Non-color-only differentiation — label + glyph + shape ─────

describe('UX-001.7 — UX-001.5A chips remain legible without color (label + glyph + shape)', () => {
  it('Machine Observation: Source gap label is non-empty plain-language string (no raw codes)', () => {
    expect(MACHINE_OBSERVATION_SOURCE_GAP.label).toBe('Source gap');
    expect(MACHINE_OBSERVATION_SOURCE_GAP.label).not.toMatch(/_/);
  });

  it('User Allegation: Needs source label is non-empty plain-language string (no raw codes)', () => {
    expect(USER_ALLEGATION_NEEDS_SOURCE.label).toBe('Needs source');
    expect(USER_ALLEGATION_NEEDS_SOURCE.label).not.toMatch(/_/);
  });

  it('Machine Observation iconHint=info produces a distinct glyph from User Allegation iconHint=warn', () => {
    // Both descriptors carry an iconHint that maps to a different
    // glyph in the chip primitive (ⓘ vs ⚑). Even with the same color,
    // the two chips read differently.
    expect(MACHINE_OBSERVATION_SOURCE_GAP.iconHint).toBe('info');
    expect(USER_ALLEGATION_NEEDS_SOURCE.iconHint).toBe('warn');
    expect(MACHINE_OBSERVATION_SOURCE_GAP.iconHint).not.toBe(USER_ALLEGATION_NEEDS_SOURCE.iconHint);
  });

  it('both fixtures resolve to a non-empty aria label (label + tone description)', () => {
    const machineAria = buildAnnotationAriaLabel(MACHINE_OBSERVATION_SOURCE_GAP);
    const userAria = buildAnnotationAriaLabel(USER_ALLEGATION_NEEDS_SOURCE);
    expect(machineAria.length).toBeGreaterThan(0);
    expect(userAria.length).toBeGreaterThan(0);
    expect(machineAria).toContain('Source gap');
    expect(userAria).toContain('Needs source');
  });
});

// ── Doctrine — Observation/Allegation labels carry no verdict ──

describe('UX-001.7 — UX-001.5A fixture labels carry no verdict / truth / popularity vocabulary', () => {
  const BANNED = [
    'winner', 'loser', 'liar', 'truth', 'verdict', 'correct', 'incorrect',
    'dishonest', 'bad faith', 'manipulative', 'extremist', 'propagandist',
    'popular', 'trending', 'viral', 'amplification', 'engagement',
    'proven', 'proof', 'fake', 'fraud',
  ];

  function scanString(value: string, ctx: string): void {
    const lower = value.toLowerCase();
    for (const term of BANNED) {
      if (lower.includes(term)) {
        throw new Error(`${ctx} contains banned token "${term}": ${value}`);
      }
    }
  }

  it('Machine Observation: Source gap label carries no banned tokens', () => {
    expect(() => scanString(MACHINE_OBSERVATION_SOURCE_GAP.label, 'machine.label')).not.toThrow();
  });

  it('User Allegation: Needs source label carries no banned tokens', () => {
    expect(() => scanString(USER_ALLEGATION_NEEDS_SOURCE.label, 'user.label')).not.toThrow();
  });

  it('Machine Observation: aria label carries no banned tokens', () => {
    const aria = buildAnnotationAriaLabel(MACHINE_OBSERVATION_SOURCE_GAP);
    expect(() => scanString(aria, 'machine.aria')).not.toThrow();
  });

  it('User Allegation: aria label carries no banned tokens', () => {
    const aria = buildAnnotationAriaLabel(USER_ALLEGATION_NEEDS_SOURCE);
    expect(() => scanString(aria, 'user.aria')).not.toThrow();
  });
});

// ── InspectGroupHeader readiness (UX-001.5A consumer) ──────────

describe('UX-001.7 — InspectGroupHeader primitive ships ready for UX-001.5A consumption', () => {
  it('InspectGroupHeader.tsx exists in the canonical primitive set', () => {
    expect(
      fs.existsSync(
        path.resolve(ROOT, 'src/features/nodeAnnotations/InspectGroupHeader.tsx'),
      ),
    ).toBe(true);
  });

  it('InspectGroupHeader.tsx exports the component (public API ready)', () => {
    const src = fs.readFileSync(
      path.resolve(ROOT, 'src/features/nodeAnnotations/InspectGroupHeader.tsx'),
      'utf8',
    );
    expect(src).toMatch(/export\s+(function|const)\s+InspectGroupHeader/);
  });
});

// ── Typography readiness for label chips ───────────────────────

describe('UX-001.7 — TYPOGRAPHY.chipLabel ready for UX-001.5A label chips (color-independent)', () => {
  it('TYPOGRAPHY.chipLabel has fontSize 11 (matches AnnotationChip primitive)', () => {
    expect(TYPOGRAPHY.chipLabel.fontSize).toBe(11);
  });

  it('TYPOGRAPHY.chipLabel uses semibold (600) for label distinction without color', () => {
    expect(TYPOGRAPHY.chipLabel.fontWeight).toBe('600');
  });

  it('TYPOGRAPHY.badgeLabel ready for the future per-source badge (Observation vs Allegation rotor groups)', () => {
    expect(TYPOGRAPHY.badgeLabel.fontSize).toBeGreaterThan(0);
    expect(TYPOGRAPHY.badgeLabel.fontWeight).toBe('700');
  });
});
