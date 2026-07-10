/**
 * QA-001 (#692) — the executable release-gate manifest for the ASP journeys J1-J10.
 *
 * This is the machine-checkable half of docs/qa/journey-gate-j1-j10.md. It pins
 * the ten-row journey coverage map so a silent rename of a spine-of-record file
 * (or a journey losing its automated cover) fails CI loudly instead of drifting
 * out of the human doc table.
 *
 * What the manifest asserts, and DELIBERATELY does NOT:
 *   - It asserts each journey's `flags`, its `blockedOn` marker, its
 *     `spineOfRecord` files (each verified present on disk), and which journeys
 *     are doc-only blocked halves waiting on VOICE-ADR-002 (#863).
 *   - It does NOT carry `flagLiveState` (the deployed on/off runtime state). That
 *     couples a test to operator flag flips; a flag flip must never break this
 *     gate. The live/off column lives ONLY in the human doc table. (RP3 ruling.)
 *
 * The gate is CONDITIONALLY GREEN: seven journeys are automatable today; J5, J8,
 * and the audio half of J6 have NO shipped surface and are honestly marked
 * BLOCKED ON #863. A blocked half is an honest "not yet," never a stubbed fake
 * surface, and it claims no spine.
 *
 * Firing negative control (MARK-001 convention): a synthetic row pointing at a
 * non-existent file must fail the existence guard — a guard that cannot fail is
 * not a test.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');

type JourneyId = 'J1' | 'J2' | 'J3' | 'J4' | 'J5' | 'J6' | 'J7' | 'J8' | 'J9' | 'J10';

/** The ASP flags the journeys need. Code default is OFF for all of them. */
type AspFlag =
  | 'home_v2'
  | 'room_exchange_v2'
  | 'proof_drawer'
  | 'voice_entries'
  | 'timestamp_rebuttals'
  | 'one_time_playback'
  | 'move_marks'
  | 'none';

interface JourneyManifestRow {
  id: JourneyId;
  title: string;
  /** One journey can need more than one flag (J6/J8 need a text + an audio flag). */
  flags: readonly AspFlag[];
  /** '#863' when ANY part of the journey is blocked on VOICE-ADR-002, else null. */
  blockedOn: string | null;
  /** Repo-relative spine-of-record files; each is verified on disk. Empty for a fully-blocked journey. */
  spineOfRecord: readonly string[];
  /** Label of the doc-only, unarmed half that waits on #863 (never has a spine), else null. */
  blockedHalf: string | null;
  /** Anchor into docs/qa/journey-gate-j1-j10.md. */
  scriptSection: string;
}

/**
 * The ten journeys, in order. Spine-of-record files marked NEW below
 * (journeyJ6TextMarkerRebuttal, journeyJ9ReviewMap) are authored by this card;
 * every other cited file is an EXISTING end-to-end walk that this card does not
 * duplicate (RP2 gap-fill ruling).
 */
const JOURNEY_MANIFEST: readonly JourneyManifestRow[] = Object.freeze([
  {
    id: 'J1',
    title: 'First-time user knows what to do',
    flags: ['home_v2'],
    blockedOn: null,
    spineOfRecord: [
      '__tests__/argumentHome.test.tsx',
      '__tests__/homeModel.test.ts',
      '__tests__/homeV2FlagOff.test.tsx',
    ],
    blockedHalf: null,
    scriptSection: '#j1',
  },
  {
    id: 'J2',
    title: 'Resume an ongoing argument',
    flags: ['home_v2'],
    blockedOn: null,
    spineOfRecord: [
      '__tests__/argumentHome.test.tsx',
      '__tests__/galleryEntryHintModel.test.ts',
      '__tests__/conversationGalleryYourTurn.test.ts',
    ],
    blockedHalf: null,
    scriptSection: '#j2',
  },
  {
    id: 'J3',
    title: 'Start an argument with a specific person',
    flags: ['home_v2'],
    blockedOn: null,
    spineOfRecord: [
      '__tests__/startArgumentSheet.test.tsx',
      '__tests__/personArgumentPickerModel.test.ts',
      '__tests__/personArgumentPicker.test.tsx',
    ],
    blockedHalf: null,
    scriptSection: '#j3',
  },
  {
    id: 'J4',
    title: 'Start a public argument (non-default)',
    flags: ['home_v2'],
    blockedOn: null,
    spineOfRecord: [
      '__tests__/publicArgumentToggleModel.test.ts',
      '__tests__/PublicArgumentToggle.test.tsx',
      '__tests__/startArgumentSheet.test.tsx',
    ],
    blockedHalf: null,
    scriptSection: '#j4',
  },
  {
    id: 'J5',
    title: 'Record a voice argument',
    flags: ['voice_entries'],
    blockedOn: '#863',
    spineOfRecord: [],
    blockedHalf: 'record-voice',
    scriptSection: '#j5',
  },
  {
    id: 'J6',
    title: 'Opponent listens once, rebuts a timestamped phrase',
    flags: ['timestamp_rebuttals', 'one_time_playback'],
    blockedOn: '#863',
    spineOfRecord: [
      '__tests__/journeyJ6TextMarkerRebuttal.test.tsx',
      '__tests__/timestampMarkerModel.test.ts',
      '__tests__/markerFlagOff.test.tsx',
    ],
    blockedHalf: 'audio-playback',
    scriptSection: '#j6',
  },
  {
    id: 'J7',
    title: 'Add proof after being challenged',
    flags: ['proof_drawer'],
    blockedOn: null,
    spineOfRecord: [
      '__tests__/proofJ7Flow.test.tsx',
      '__tests__/proofDrawerModel.test.ts',
      '__tests__/proofDrawerCopyBanList.test.ts',
    ],
    blockedHalf: null,
    scriptSection: '#j7',
  },
  {
    id: 'J8',
    title: 'Save a recording before it expires',
    flags: ['voice_entries', 'one_time_playback'],
    blockedOn: '#863',
    spineOfRecord: [],
    blockedHalf: 'save-recording',
    scriptSection: '#j8',
  },
  {
    id: 'J9',
    title: 'Review the argument map after several turns',
    flags: ['room_exchange_v2'],
    blockedOn: null,
    spineOfRecord: [
      '__tests__/journeyJ9ReviewMap.test.tsx',
      '__tests__/argumentStateRailModel.test.ts',
      '__tests__/mapNodeActionSurfaceModel.test.ts',
      '__tests__/roomCapabilityParityMatrix.test.ts',
      '__tests__/roomMediatorAdapter.test.ts',
      '__tests__/nodeMediatorMarkers.test.ts',
      '__tests__/uxMediator002NodeMarkup.test.tsx',
      '__tests__/DisagreementPointsRail.test.tsx',
    ],
    blockedHalf: null,
    scriptSection: '#j9',
  },
  {
    id: 'J10',
    title: 'Boolean feedback without game-submission feel',
    flags: ['move_marks'],
    blockedOn: null,
    spineOfRecord: [
      '__tests__/moveMarksRoomAggregateWiring.test.tsx',
      '__tests__/BooleanFeedbackBar.test.tsx',
      '__tests__/feedbackMoveMarksNoStanding.test.ts',
    ],
    blockedHalf: null,
    scriptSection: '#j10',
  },
]);

const EXPECTED_IDS: readonly JourneyId[] = ['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7', 'J8', 'J9', 'J10'];

/** The three doc-only halves that wait on VOICE-ADR-002 (#863). */
const EXPECTED_BLOCKED_HALVES: readonly string[] = ['audio-playback', 'record-voice', 'save-recording'];

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

describe('QA-001 (#692) — journey manifest shape', () => {
  it('has exactly ten rows', () => {
    expect(JOURNEY_MANIFEST).toHaveLength(10);
  });

  it('is J1..J10 with no gaps or duplicates', () => {
    expect(JOURNEY_MANIFEST.map((r) => r.id)).toEqual(EXPECTED_IDS);
    expect(new Set(JOURNEY_MANIFEST.map((r) => r.id)).size).toBe(10);
  });

  it('is frozen (the release gate is not mutated at runtime)', () => {
    expect(Object.isFrozen(JOURNEY_MANIFEST)).toBe(true);
  });

  it('never carries flagLiveState — operator flag flips must not break CI (RP3)', () => {
    for (const row of JOURNEY_MANIFEST) {
      expect(Object.prototype.hasOwnProperty.call(row, 'flagLiveState')).toBe(false);
    }
  });

  it('every row names at least one flag', () => {
    for (const row of JOURNEY_MANIFEST) {
      expect(row.flags.length).toBeGreaterThan(0);
    }
  });
});

describe('QA-001 (#692) — spine-of-record files resolve on disk', () => {
  const withSpine = JOURNEY_MANIFEST.filter((r) => r.spineOfRecord.length > 0);

  it.each(withSpine)('$id cites at least one spine and every file exists', (row) => {
    expect(row.spineOfRecord.length).toBeGreaterThan(0);
    for (const rel of row.spineOfRecord) {
      expect({ id: row.id, rel, exists: fileExists(rel) }).toEqual({ id: row.id, rel, exists: true });
    }
  });

  it('every automatable journey (blockedOn === null) claims a spine', () => {
    for (const row of JOURNEY_MANIFEST) {
      if (row.blockedOn === null) {
        expect(row.spineOfRecord.length).toBeGreaterThan(0);
      }
    }
  });

  it('the two NEW spines authored by this card are the J6 and J9 cover', () => {
    const j6 = JOURNEY_MANIFEST.find((r) => r.id === 'J6');
    const j9 = JOURNEY_MANIFEST.find((r) => r.id === 'J9');
    expect(j6?.spineOfRecord).toContain('__tests__/journeyJ6TextMarkerRebuttal.test.tsx');
    expect(j9?.spineOfRecord).toContain('__tests__/journeyJ9ReviewMap.test.tsx');
  });
});

describe('QA-001 (#692) — voice journeys are honestly BLOCKED ON #863', () => {
  const fullyBlocked = JOURNEY_MANIFEST.filter((r) => r.spineOfRecord.length === 0);

  it('the only fully-blocked journeys (no spine) are J5 and J8', () => {
    expect(fullyBlocked.map((r) => r.id).sort()).toEqual(['J5', 'J8']);
  });

  it('each fully-blocked journey carries the #863 marker and only voice/playback flags', () => {
    for (const row of fullyBlocked) {
      expect(row.blockedOn).toBe('#863');
      expect(row.blockedHalf).not.toBeNull();
      for (const flag of row.flags) {
        expect(['voice_entries', 'one_time_playback']).toContain(flag);
      }
    }
  });

  it('the three doc-only blocked halves (J5, J8, J6-audio) claim no spine and carry #863', () => {
    // A blocked HALF is doc-only: it has no armed surface, so it can never claim a
    // test. J6-audio is the audio half of an otherwise-automatable text journey.
    const blockedHalfRows = JOURNEY_MANIFEST.filter((r) => r.blockedHalf !== null);
    expect(blockedHalfRows.map((r) => r.id).sort()).toEqual(['J5', 'J6', 'J8']);
    expect(blockedHalfRows.map((r) => r.blockedHalf).sort()).toEqual(EXPECTED_BLOCKED_HALVES);
    for (const row of blockedHalfRows) {
      expect(row.blockedOn).toBe('#863');
    }
  });

  it('J6 is the mixed journey: an armed text spine + a #863-blocked audio half', () => {
    const j6 = JOURNEY_MANIFEST.find((r) => r.id === 'J6');
    expect(j6).toBeDefined();
    expect(j6?.spineOfRecord.length).toBeGreaterThan(0); // text half is armed
    expect(j6?.blockedHalf).toBe('audio-playback'); // audio half is not
    expect(j6?.blockedOn).toBe('#863');
    expect(j6?.flags).toContain('timestamp_rebuttals'); // text half flag
    expect(j6?.flags).toContain('one_time_playback'); // audio half flag
  });
});

describe('QA-001 (#692) — every script section is anchored', () => {
  it('each journey points at its own #jN anchor in the gate doc', () => {
    for (const row of JOURNEY_MANIFEST) {
      expect(row.scriptSection).toBe(`#${row.id.toLowerCase()}`);
    }
  });
});

describe('QA-001 (#692) — firing negative control (the existence guard can fail)', () => {
  it('a synthetic row pointing at a non-existent file fails the existence check', () => {
    const synthetic: JourneyManifestRow = {
      id: 'J1',
      title: 'synthetic',
      flags: ['none'],
      blockedOn: null,
      spineOfRecord: ['__tests__/__does_not_exist__.test.ts'],
      blockedHalf: null,
      scriptSection: '#j1',
    };
    // Proves the guard is real: this path does NOT resolve, so the same assertion
    // the real rows pass would throw for this planted row.
    expect(fileExists(synthetic.spineOfRecord[0])).toBe(false);
  });

  it('every real cited spine file, by contrast, resolves', () => {
    const allSpineFiles = JOURNEY_MANIFEST.flatMap((r) => r.spineOfRecord);
    expect(allSpineFiles.length).toBeGreaterThan(0);
    for (const rel of allSpineFiles) {
      expect(fileExists(rel)).toBe(true);
    }
  });
});
