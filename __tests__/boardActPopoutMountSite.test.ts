/**
 * UX-001.4 — Board-level ActPopout mount site source scan.
 *
 * Verifies the board-level Act mount exists in the room/ArgumentRoom.tsx
 * orchestrator (ASP-EXTRACT-001 Slice 2 moved it out of ArgumentGameSurface),
 * wires the expected props (actingOnLabel, maxHeightOverride, etc.),
 * and consumes the existing 3-gate `buildActPopout` via the existing
 * `actEntryToQuickAction` + `quickActionToPreset` round-trip — never a
 * direct Supabase write, never a router push.
 */
import fs from 'fs';
import path from 'path';

const SURFACE_PATH = path.resolve(
  __dirname,
  '..',
  'src',
  'features',
  'arguments',
  'room',
  'ArgumentRoom.tsx',
);

describe('UX-001.4 — board-level ActPopout mount source scan', () => {
  const src = fs.readFileSync(SURFACE_PATH, 'utf8');

  it('imports ActPopout from oneBox/ActPopout', () => {
    // ASP-EXTRACT-001 (Slice 2) — the orchestrator sits one dir deeper (room/),
    // so its relative import of oneBox/ is ../oneBox/ not ./oneBox/.
    expect(src).toMatch(/import\s+\{\s*ActPopout\s*\}\s+from\s+['"]\.\.\/oneBox\/ActPopout['"]/);
  });

  it('mounts <ActPopout> with testID "board-act-popout"', () => {
    expect(src).toMatch(/testID="board-act-popout"/);
  });

  it('threads actingOnLabel prop from boardActActingOnLabel', () => {
    expect(src).toMatch(/actingOnLabel=\{boardActActingOnLabel\}/);
  });

  it('threads maxHeightOverride from actPresentation.maxHeight', () => {
    expect(src).toMatch(/maxHeightOverride=\{actPresentation\.maxHeight\}/);
  });

  it('threads panelWidthOverride from actPresentation.width', () => {
    expect(src).toMatch(/panelWidthOverride=\{actPresentation\.width\}/);
  });

  it('threads rules from useConstitution().activeRules', () => {
    expect(src).toMatch(/const constitution = useConstitution\(\)/);
    expect(src).toMatch(/rules=\{constitution\.activeRules\}/);
  });

  it('threads stage from activeStage (LIFE-001 cluster state)', () => {
    expect(src).toMatch(/stage=\{activeStage\}/);
  });

  it('threads parentType from activeParentType (engine-gate input)', () => {
    expect(src).toMatch(/parentType=\{activeParentType\}/);
  });

  it('wires onSelectBoxType via the existing actEntryToQuickAction path', () => {
    expect(src).toMatch(/actEntryToQuickAction\(entryId\)/);
    expect(src).toMatch(/quickActionToPreset\(/);
  });

  it('opens via setBoardActVisible state setter', () => {
    expect(src).toMatch(/setBoardActVisible\(true\)/);
    expect(src).toMatch(/setBoardActVisible\(false\)/);
  });

  it('does NOT introduce a router import (no route transition)', () => {
    expect(src).not.toMatch(/useNavigation|useRouter|useLinkTo|from\s+['"]expo-router['"]/);
  });

  it('does NOT introduce a supabase import (no direct write path)', () => {
    // The surface file may import Supabase indirectly via metadata API
    // (pre-UX-001.4); the UX-001.4 menu mounts must NOT add a new
    // import. Strict source-scan: the file imports `supabase` ONLY
    // through the existing META-1A `pointTagsApi` and `metadata/`
    // helpers — never via a new direct from-supabase import line.
    const supabaseImports = src.match(/from\s+['"][^'"]*supabase[^'"]*['"]/g);
    if (supabaseImports) {
      // None of the imports should be a direct supabase client import.
      for (const imp of supabaseImports) {
        expect(imp).not.toMatch(/from\s+['"]\.\.\/\.\.\/lib\/supabase['"]/);
      }
    }
  });
});
