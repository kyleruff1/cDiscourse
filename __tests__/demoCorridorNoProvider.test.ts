/**
 * DEMO-001 — No-provider / no-credential source scan.
 *
 * Reads every file under `src/features/demoCorridor/` and proves the corridor
 * path performs ZERO network / provider / credential / submit work. The
 * corridor mounts the REAL surface (which is itself prop-driven, no I/O) and
 * intercepts the move at the existing pre-network `onBeforeSubmit` seam — it
 * never imports the room data hook, the Edge wrappers, or the submit chain.
 *
 * It also pins the IMPORT-ABSENCE half of the byte-untouched submit-chain
 * guarantee (the "not in the card diff" half is reviewer-verified).
 */
import * as fs from 'fs';
import * as path from 'path';

const DIR = path.join(process.cwd(), 'src/features/demoCorridor');

function corridorFiles(): string[] {
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
    .map((f) => path.join(DIR, f));
}

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

describe('demoCorridor — forbidden network / provider / credential tokens', () => {
  const FORBIDDEN: ReadonlyArray<string> = [
    'supabase',
    'submitArgumentDraft',
    'edgeFunctions',
    'useArgumentRoomMessages',
    'fetch(',
    'Anthropic',
    'anthropic',
    'xai',
    'x_search',
    'SERVICE_ROLE',
    'service_role',
    'request-review',
    'requestReview',
    'submit-argument',
  ];

  it('scans more than one corridor file', () => {
    expect(corridorFiles().length).toBeGreaterThan(4);
  });

  it.each(FORBIDDEN.map((t) => [t] as const))(
    'no corridor file contains "%s"',
    (token) => {
      for (const file of corridorFiles()) {
        const src = read(file);
        expect(src.includes(token)).toBe(false);
      }
    },
  );
});

describe('demoCorridor — mounts the REAL components (not a parallel UI)', () => {
  it('the screen imports the shipped ArgumentGameSurface', () => {
    const src = read(path.join(DIR, 'DemoCorridorScreen.tsx'));
    expect(src).toMatch(/import \{ ArgumentGameSurface \} from '\.\.\/arguments\/ArgumentGameSurface'/);
  });

  it('the composer panel imports the shipped OneBox and the existing onBeforeSubmit seam', () => {
    const src = read(path.join(DIR, 'DemoComposerPanel.tsx'));
    expect(src).toMatch(/import \{ OneBox \} from '\.\.\/arguments\/oneBox\/OneBox'/);
    expect(src).toMatch(/onBeforeSubmit=\{/);
  });

  it('the composer seam supplies a function that returns false (pre-network suppressor)', () => {
    // The factory lives in the pure model; the panel wires it. Both are read
    // here so a future refactor that drops the `return false` is caught.
    const model = read(path.join(DIR, 'corridorModel.ts'));
    expect(model).toMatch(/makeDemoBeforeSubmit[\s\S]*return false;/);
  });
});

describe('demoCorridor — submit-chain import-absence half', () => {
  it('no corridor file imports any production submit-chain module', () => {
    const SUBMIT_CHAIN = [
      'ArgumentComposer',
      'composerSubmit',
      'useArgumentComposer',
      'composerState',
    ];
    for (const file of corridorFiles()) {
      const src = read(file);
      for (const mod of SUBMIT_CHAIN) {
        // The corridor reaches the composer ONLY through OneBox; it never
        // imports the composer body or its submit helpers directly.
        expect(src).not.toMatch(new RegExp(`import[^\\n]*${mod}`));
      }
    }
  });
});
