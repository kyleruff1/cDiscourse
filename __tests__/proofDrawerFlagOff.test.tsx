/**
 * PROOF-002 (#889) — flag-off byte-identity proofs (the #882/roomThree lane).
 *
 * Source-scan discipline: App.tsx is the sole flag consumer; the drawer mount +
 * the Source-slot onOpenProof + the read-path flip are all gated on the flag; the
 * three ROOM-003 files read no featureFlags; the composer Source testID is
 * unchanged; the ArgumentRoom read-seam is disabled when the flag is off.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const APP_SRC = fs.readFileSync(path.join(ROOT, 'App.tsx'), 'utf8');
const ROOM_SRC = fs.readFileSync(path.join(ROOT, 'src/features/arguments/room/ArgumentRoom.tsx'), 'utf8');
const BAR_SRC = fs.readFileSync(path.join(ROOT, 'src/features/arguments/composer/ArgumentEntryComposer.tsx'), 'utf8');
const ADAPTER_SRC = fs.readFileSync(path.join(ROOT, 'src/features/arguments/argumentGameSurfaceEvidence.ts'), 'utf8');
const COMPOSER_DIR = path.join(ROOT, 'src', 'features', 'arguments', 'composer');
const ROOM_THREE_FILES = ['ArgumentEntryComposer.tsx', 'argumentEntryComposerModel.ts', 'useEntryComposerSubmit.ts'];

describe('PROOF-002 flag-off — App.tsx is the sole flag consumer', () => {
  it('reads isProofDrawerEnabled from the registry', () => {
    expect(APP_SRC).toMatch(/import\s+\{\s*isProofDrawerEnabled\s*\}\s+from\s+['"]\.\/src\/lib\/featureFlags['"]/);
    expect(APP_SRC).toContain('const proofDrawerEnabled = isProofDrawerEnabled();');
  });

  it('gates the ProofDrawer mount on proofDrawerEnabled AND a live scope', () => {
    expect(APP_SRC).toMatch(/\{proofDrawerEnabled && proofDrawerScope !== null \? \(\s*\n\s*<ProofDrawer/);
  });

  it('gates the Source-slot onOpenProof callback on the flag (undefined when off)', () => {
    expect(APP_SRC).toContain('onOpenProof={proofDrawerEnabled ? openProofForDraft : undefined}');
  });

  it('threads proofDrawerEnabled into ArgumentTreeScreen', () => {
    expect(APP_SRC).toContain('proofDrawerEnabled={proofDrawerEnabled}');
  });
});

describe('PROOF-002 flag-off — the ROOM-003 files read no featureFlags', () => {
  it('none of the three ROOM-003 files import featureFlags', () => {
    for (const name of ROOM_THREE_FILES) {
      const src = fs.readFileSync(path.join(COMPOSER_DIR, name), 'utf8');
      expect({ name, hit: /featureFlags/.test(src) }).toEqual({ name, hit: false });
    }
  });

  it('the Source slot testID is unchanged (dual-render stability)', () => {
    expect(BAR_SRC).toContain('testID="argument-entry-composer-proof"');
  });

  it('the Source slot routes to onOpenProof ?? onOpenMore (absent onOpenProof => More)', () => {
    expect(BAR_SRC).toContain('onPress={onOpenProof ?? onOpenMore}');
  });
});

describe('PROOF-002 flag-off — the ArgumentRoom read-seam is flag-gated', () => {
  it('useProofItems is disabled unless proofDrawerEnabled is true', () => {
    expect(ROOM_SRC).toContain('useProofItems(debate.id, chronologicalIds, proofDrawerEnabled === true)');
  });

  it('the adapter receives the proof rows (rows-first, JSONB fallback)', () => {
    expect(ROOM_SRC).toContain('buildArtifactsByMessageId(sorted, proofItemsByMessageId)');
  });
});

describe('PROOF-002 flag-off — the adapter degrades to JSONB when the arg is absent', () => {
  it('buildArtifactsByMessageId takes an OPTIONAL second arg', () => {
    expect(ADAPTER_SRC).toMatch(/proofItemsByMessageId\?:\s*Record<string, ReadonlyArray<ProofItemRow>>/);
  });

  it('falls back to the JSONB buildEvidenceArtifacts path', () => {
    expect(ADAPTER_SRC).toContain('buildEvidenceArtifacts');
    expect(ADAPTER_SRC).toContain('proofItemRowToEvidenceArtifact');
  });
});
