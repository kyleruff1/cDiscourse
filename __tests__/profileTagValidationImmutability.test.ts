/**
 * PR-002 — the named "validation-gate immutability test".
 *
 * Proves the card's two doctrine-load-bearing acceptance criteria:
 *   1. Profile tags do NOT affect truth / score.
 *   2. Profile tags do NOT change validation gates.
 *
 * Strategy (two-pronged):
 *
 *   1. Byte-identical gate output, with and without tags. The repo's
 *      real validation / scoring entry points are run twice for a fixed
 *      set of representative inputs — once with no profile-tag state, and
 *      once after a full 5-tag `ProfileTagSelection` has been created and
 *      persisted to the (mocked) AsyncStorage. The outputs must be
 *      `toEqual`-identical. The gate functions take explicit JSON inputs
 *      that contain NO tag field, so this is true by construction — and
 *      the test makes it provably and regression-safely true: if a future
 *      change ever threaded a profile tag into a gate signature, this
 *      test fails.
 *
 *   2. Import-isolation source-scan. The gate modules are scanned to
 *      assert none of them import from `src/features/profileTags/`; and
 *      the whole `profileTags` folder is scanned to assert none of its
 *      files import a scoring / engine / validation module. Together the
 *      two halves guarantee tags and gates are structurally incommunicado.
 */

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// ── Real gate / scoring entry points ────────────────────────────
import {
  hasViolations,
  runDeterministicChecks,
  validateBodyLength,
  validateDepth,
  validateTransition,
} from '../src/domain/constitution/engine';
import { constitutionV1 } from '../src/domain/constitution/v1';
import type { ArgumentInput } from '../src/domain/constitution/types';
import { computeStatementStanding } from '../src/features/arguments/argumentScoreModel';
import { applyAntiAmplification } from '../src/features/pointStanding/antiAmplification';
import type {
  AmplificationContext,
  PointStandingDelta,
} from '../src/features/pointStanding/types';

// ── Profile-tags feature ────────────────────────────────────────
import type { ProfileTagSelection } from '../src/features/profileTags/profileTagModel';
import { saveProfileTags } from '../src/features/profileTags/profileTagsStorage';
import { PROFILE_TAG_VOCABULARY } from '../src/features/profileTags/profileTagVocabulary';

const c = constitutionV1;

// A full 5-tag selection — the cap. This is the "tags present" state.
const FULL_SELECTION: ProfileTagSelection = {
  schemaVersion: 1,
  selectedTagIds: PROFILE_TAG_VOCABULARY.slice(0, 5).map((t) => t.id),
};

// ── Representative gate inputs (contain NO tag field) ────────────

const argInput = (overrides: Partial<ArgumentInput> = {}): ArgumentInput => ({
  type: 'CLM',
  side: 'affirmative',
  body: 'This is a valid claim body that is long enough to clear the floor.',
  tags: [],
  evidenceLinks: [],
  depth: 0,
  parentType: null,
  ...overrides,
});

const standingMessage = {
  id: 'm1',
  debateId: 'd1',
  parentId: null,
  authorId: 'author-1',
  argumentType: 'CLM',
  side: 'affirmative',
  body: 'A representative argument body for the scoring gate.',
  status: 'posted',
  createdAt: '2026-05-19T00:00:00.000Z',
  isBot: false,
  flagCodes: [],
  tagCodes: [],
  topicScore: 0.6,
  hasEvidence: true,
};

const amplificationDelta: PointStandingDelta = {
  pointId: 'point-1',
  causedByArgumentId: 'arg-1',
  broadStandingDelta: 0.3,
  narrowStandingDelta: 0.2,
  challengerPressureGain: 0.1,
  responderRecoveryGain: 0,
  concessionIntegrityGain: 0,
  impliedConcessionPenalty: 0,
  unresolvedDebtPenalty: 0,
  exploitRiskScore: 0.1,
};

const amplificationContext: AmplificationContext = {
  platformSupportWarning: true,
  evidentiaryRisk: 'high',
  amplificationRisk: 'high',
  appealToVirality: true,
  appealToCrowdSize: true,
  highEngagementLowEvidence: true,
  unknownSourceChain: true,
  bringsEvidenceOrNarrowing: false,
};

/**
 * Run every representative gate once and collect the outputs into a
 * single JSON-serialisable snapshot. The snapshot is what the test
 * compares before and after profile tags exist.
 */
function gateSnapshot(): unknown {
  const transitionOk = validateTransition('CLM', 'EVD', c);
  const transitionBad = validateTransition('EVD', 'EVD', c);
  const depthOk = validateDepth(2, c);
  const depthBad = validateDepth(c.structuralLimits.maxDepth + 5, c);
  const bodyShort = validateBodyLength('too short', c);
  const bodyOk = validateBodyLength(
    'A body that comfortably clears the twenty-character floor.',
    c,
  );
  const checks = runDeterministicChecks(argInput(), c);
  const checksBad = runDeterministicChecks(
    argInput({ depth: c.structuralLimits.maxDepth + 1, body: 'x' }),
    c,
  );
  const standing = computeStatementStanding({
    message: standingMessage,
    currentUserId: 'viewer-1',
  });
  const antiAmp = applyAntiAmplification(amplificationDelta, amplificationContext);
  return {
    transitionOk,
    transitionBad,
    depthOk,
    depthBad,
    bodyShort,
    bodyOk,
    checks,
    checksHasViolations: hasViolations(checks),
    checksBad,
    standing,
    antiAmp,
  };
}

// ── Prong 1 — byte-identical gate output ────────────────────────

describe('validation / scoring gates are byte-identical with and without profile tags', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('produces identical gate output before any profile tag exists and after a full 5-tag selection is saved', async () => {
    // Baseline: no profile-tag state anywhere.
    const before = JSON.stringify(gateSnapshot());

    // Create the maximum profile-tag state and persist it.
    await saveProfileTags('viewer-1', FULL_SELECTION);
    const stored = await AsyncStorage.getItem(
      'cdiscourse:profile-tags:viewer-1',
    );
    expect(stored).toBeTruthy(); // the tag state genuinely exists now

    // Re-run every gate. The output must not have moved by a single byte.
    const after = JSON.stringify(gateSnapshot());
    expect(after).toEqual(before);
  });

  it('the standing band is unchanged when profile tags are present', async () => {
    const bandBefore = computeStatementStanding({
      message: standingMessage,
      currentUserId: 'viewer-1',
    }).standingBand;
    await saveProfileTags('viewer-1', FULL_SELECTION);
    const bandAfter = computeStatementStanding({
      message: standingMessage,
      currentUserId: 'viewer-1',
    }).standingBand;
    expect(bandAfter).toBe(bandBefore);
  });

  it('a validation gate still blocks / passes exactly the same inputs regardless of tag state', async () => {
    const validBefore = runDeterministicChecks(argInput(), c);
    await saveProfileTags('viewer-1', FULL_SELECTION);
    const validAfter = runDeterministicChecks(argInput(), c);
    expect(hasViolations(validAfter)).toBe(hasViolations(validBefore));
    expect(JSON.stringify(validAfter)).toEqual(JSON.stringify(validBefore));
  });
});

// ── Prong 2 — import-isolation source-scan ──────────────────────

/** Every `import ... from '...'` specifier in a source file. */
const importSpecifiers = (src: string): string[] => {
  const specs: string[] = [];
  const re = /import[\s\S]*?from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) specs.push(m[1]);
  return specs;
};

const REPO = join(__dirname, '..');
const readSrc = (rel: string) => readFileSync(join(REPO, rel), 'utf8');

describe('profile tags and gates are structurally incommunicado', () => {
  // The gate / scoring modules must never reach into the profileTags
  // feature — a gate cannot read a tag.
  const GATE_MODULES = [
    'src/domain/constitution/engine.ts',
    'src/features/arguments/argumentScoreModel.ts',
    'src/features/pointStanding/antiAmplification.ts',
    'src/features/pointStanding/scoringEngine.ts',
  ];

  const PROFILE_TAG_SPECIFIER_TOKENS = [
    'profileTags',
    'profileTagModel',
    'profileTagVocabulary',
    'profileTagsStorage',
    'profileTagCopy',
    'useProfileTags',
  ];

  it('no gate / scoring module imports anything from src/features/profileTags/', () => {
    for (const mod of GATE_MODULES) {
      const specs = importSpecifiers(readSrc(mod));
      for (const spec of specs) {
        for (const token of PROFILE_TAG_SPECIFIER_TOKENS) {
          expect(spec).not.toContain(token);
        }
      }
    }
  });

  // Conversely, no profileTags file may import a gate / scoring /
  // validation module — a tag module cannot reach a gate.
  const FORBIDDEN_GATE_IMPORTS = [
    'constitution/engine',
    'argumentScoreModel',
    'pointStanding',
    'antiAmplification',
    'evaluateArgumentDraft',
    'clientValidation',
  ];

  it('no file under src/features/profileTags/ imports a score / engine / validation module', () => {
    const dir = join(REPO, 'src', 'features', 'profileTags');
    const files = readdirSync(dir).filter(
      (f) => f.endsWith('.ts') || f.endsWith('.tsx'),
    );
    // Sanity: the feature folder genuinely has its files.
    expect(files.length).toBeGreaterThanOrEqual(8);
    for (const file of files) {
      const specs = importSpecifiers(readFileSync(join(dir, file), 'utf8'));
      for (const spec of specs) {
        for (const mod of FORBIDDEN_GATE_IMPORTS) {
          expect(spec).not.toContain(mod);
        }
      }
    }
  });
});
