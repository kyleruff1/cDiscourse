/**
 * DEMO-001 — Recruitable Debate Demo Corridor: the bundled fixture room.
 *
 * Pure data. Imports ONLY the surface prop TYPES — no React, no Supabase, no
 * network, no provider, no `fetch`, no `Date.now`. Every datum the real
 * `ArgumentGameSurface` renders for the corridor arrives from the literals in
 * this file; the corridor never touches the network for its content
 * (DEMO-001 design §"Central decision: fixture room").
 *
 * The topic is a synthetic, neutral, unheated municipal debate — the town
 * library's weeknight closing hours — per the fixture-discipline convention
 * (cdiscourse-doctrine §"Fixture discipline"). No real persons, X handles,
 * URLs to real sites, or PII. The lone author id is the stand-in
 * `'demo-viewer'`.
 *
 * The `source_owed` lever (design §"The source_owed lever"): the disputed
 * sub-claim carries an OPEN `source_request`-tagged ask with no attached
 * evidence, so the surface's pure `deriveEvidenceDebts` → `buildOpenIssue`
 * chain yields `burden: 'source_owed'` on the active node. The
 * `demoCorridorFixture` test pins this through the real derivation rather
 * than trusting it by inspection.
 */
import type { ArgumentMessageInput } from '../arguments/argumentGameSurfaceModel';
import type { ArgumentTag, ArgumentFlag, ArgumentRow } from '../arguments/types';
import type { PersistedPointTag, MachineObservationResultRow } from '../arguments/types';
import type { Debate } from '../debates/types';

// ── Stable identifiers ─────────────────────────────────────────

/** The fixture room id. Deliberately not a UUID — it is never a DB row. */
export const DEMO_ROOM_ID = 'demo-corridor-room';

/** The stand-in viewer id (drives own-bubble classification only). */
export const DEMO_VIEWER_ID = 'demo-viewer';

/** Message ids referenced across states + tests. */
export const DEMO_MSG = Object.freeze({
  root: 'demo-arg-root',
  claim: 'demo-arg-claim',
  ask: 'demo-arg-ask',
  viewerAsk: 'demo-arg-viewer-ask',
  evidence: 'demo-arg-evidence',
  narrow: 'demo-arg-narrow',
  branch: 'demo-arg-branch',
});

// ── Frozen timestamps ──────────────────────────────────────────
// Fixed ISO instants keep the fixture deterministic (replay is idempotent).
// Even when the wall clock drifts far past these, the open source debt stays
// OPEN (a stale debt is still open), so the Referee Card keeps reading
// "Source owed".
const T0 = '2026-06-12T09:00:00.000Z';
const T1 = '2026-06-12T09:05:00.000Z';
const T2 = '2026-06-12T09:09:00.000Z';
const T3 = '2026-06-12T09:14:00.000Z';

/** A deterministic "now" for the fixture derivation tests (just after T3). */
export const DEMO_FIXTURE_NOW_MS = Date.parse('2026-06-12T09:15:00.000Z');

// ── Fixture state ids + the scripted move→state table ──────────

export type DemoFixtureStateId =
  | 'disputed' // root claim + disputed sub-point + open source ask → Source owed.
  | 'after_ask_source' // the viewer logs their own source ask → Source requested.
  | 'after_add_evidence' // a source is supplied → the source debt resolves.
  | 'after_narrow' // the claim is narrowed in scope.
  | 'after_branch'; // a side issue opens on its own lane; the mainline is kept.

/** Every fixture state id, frozen, for exhaustive iteration in tests. */
export const ALL_DEMO_FIXTURE_STATE_IDS: ReadonlyArray<DemoFixtureStateId> =
  Object.freeze(['disputed', 'after_ask_source', 'after_add_evidence', 'after_narrow', 'after_branch']);

/** The four canonical plain moves (REF-ADR-001 — no internal type codes). */
export type DemoMoveCode = 'ask_source' | 'add_evidence' | 'narrow' | 'branch';

export const ALL_DEMO_MOVE_CODES: ReadonlyArray<DemoMoveCode> = Object.freeze([
  'ask_source',
  'add_evidence',
  'narrow',
  'branch',
]);

/** move → the fixture state the corridor swaps to (the scripted state table). */
export const DEMO_MOVE_TRANSITIONS: Readonly<Record<DemoMoveCode, DemoFixtureStateId>> = Object.freeze({
  ask_source: 'after_ask_source',
  add_evidence: 'after_add_evidence',
  narrow: 'after_narrow',
  branch: 'after_branch',
});

// ── Fixture room shape ─────────────────────────────────────────

export interface DemoFixtureRoomState {
  debate: { id: string; title: string | null; rootBody: string | null };
  messages: ReadonlyArray<ArgumentMessageInput>;
  tagsByArgumentId: Record<string, ArgumentTag[]>;
  flagsByArgumentId: Record<string, ArgumentFlag[]>;
  pointTagsByArgumentId: Record<string, PersistedPointTag[]>;
  persistedObservationsByArgumentId: Record<string, MachineObservationResultRow[]>;
  latestMessageId: string;
  /** The node whose Referee Card teaches in this state (pinned via entryHint). */
  activeMessageId: string;
}

// ── Authored bodies (ban-list clean; plain language) ───────────

const ROOT_BODY =
  'Our town library should stay open until 9 pm on weeknights so working residents can use it after dinner.';
const CLAIM_BODY =
  'Weeknight visits after 6 pm are too few to justify staffing the building until 9 pm.';
const ASK_BODY =
  'Which weeknight visit counts is that based on? A source for the after-6 pm numbers would help us weigh it.';
const VIEWER_ASK_BODY =
  'Adding my own request on the record: where can we read the weeknight visit counts for the 6-to-9 pm window?';
const EVIDENCE_BODY =
  'Here are the counts: the parks-and-libraries quarterly report lists the weeknight evening visits.';
const NARROW_BODY =
  'I would narrow this to the summer term, when weeknight evening visits drop the most. The rest of the year I still accept.';
const BRANCH_BODY =
  'Separate question worth its own thread: should weekend hours change at the same time, or stay as they are?';

const DEMO_TITLE = 'Library weeknight hours';

// ── Message builders ───────────────────────────────────────────

function msg(
  partial: Pick<ArgumentMessageInput, 'id' | 'parentId' | 'argumentType' | 'side' | 'body' | 'createdAt'> &
    Partial<ArgumentMessageInput>,
): ArgumentMessageInput {
  return {
    debateId: DEMO_ROOM_ID,
    authorId: DEMO_VIEWER_ID,
    status: 'posted',
    updatedAt: partial.createdAt,
    isBot: false,
    ...partial,
  };
}

const ROOT = msg({
  id: DEMO_MSG.root,
  parentId: null,
  argumentType: 'thesis',
  side: 'affirmative',
  body: ROOT_BODY,
  createdAt: T0,
});

const CLAIM = msg({
  id: DEMO_MSG.claim,
  parentId: DEMO_MSG.root,
  argumentType: 'rebuttal',
  side: 'negative',
  body: CLAIM_BODY,
  createdAt: T1,
});

// The open source ask: a clarification_request tagged `source_request` and
// carrying NO attached evidence → opens a `source` evidence debt on its
// parent (the disputed claim). This is the `source_owed` lever.
const ASK = msg({
  id: DEMO_MSG.ask,
  parentId: DEMO_MSG.claim,
  argumentType: 'clarification_request',
  side: 'affirmative',
  body: ASK_BODY,
  createdAt: T2,
});

const VIEWER_ASK = msg({
  id: DEMO_MSG.viewerAsk,
  parentId: DEMO_MSG.claim,
  argumentType: 'clarification_request',
  side: 'affirmative',
  body: VIEWER_ASK_BODY,
  createdAt: T3,
});

// The supplied source: an evidence move carrying an attached source (URL +
// source text). It discharges the `source` debt on the disputed claim.
const EVIDENCE = msg({
  id: DEMO_MSG.evidence,
  parentId: DEMO_MSG.claim,
  argumentType: 'evidence',
  side: 'negative',
  body: EVIDENCE_BODY,
  createdAt: T3,
  attachedEvidence: [
    {
      url: 'https://example.test/town-library/visit-counts',
      label: 'Town parks-and-libraries quarterly report',
      sourceText:
        'Weeknight 6-to-9 pm library visits averaged 41 per evening across the most recent quarter.',
      quote: null,
    },
  ],
});

const NARROW = msg({
  id: DEMO_MSG.narrow,
  parentId: DEMO_MSG.claim,
  argumentType: 'concession',
  side: 'negative',
  body: NARROW_BODY,
  createdAt: T3,
});

const BRANCH = msg({
  id: DEMO_MSG.branch,
  parentId: DEMO_MSG.root,
  argumentType: 'claim',
  side: 'neutral',
  body: BRANCH_BODY,
  createdAt: T3,
});

// ── Tag maps ───────────────────────────────────────────────────

function tag(argumentId: string, tagCode: string, createdAt: string): ArgumentTag {
  return { argumentId, tagCode, createdAt };
}

/** The base tag map shared by every state: the opponent's open source ask. */
const BASE_TAGS: Record<string, ArgumentTag[]> = {
  [DEMO_MSG.ask]: [tag(DEMO_MSG.ask, 'source_request', T2)],
};

const EMPTY_FLAGS: Record<string, ArgumentFlag[]> = {};
const EMPTY_POINT_TAGS: Record<string, PersistedPointTag[]> = {};
const EMPTY_OBSERVATIONS: Record<string, MachineObservationResultRow[]> = {};

// ── The five fixture states ────────────────────────────────────

const DEBATE = Object.freeze({ id: DEMO_ROOM_ID, title: DEMO_TITLE, rootBody: ROOT_BODY });

function state(
  messages: ReadonlyArray<ArgumentMessageInput>,
  tagsByArgumentId: Record<string, ArgumentTag[]>,
  latestMessageId: string,
  activeMessageId: string,
): DemoFixtureRoomState {
  return {
    debate: DEBATE,
    messages,
    tagsByArgumentId,
    flagsByArgumentId: EMPTY_FLAGS,
    pointTagsByArgumentId: EMPTY_POINT_TAGS,
    persistedObservationsByArgumentId: EMPTY_OBSERVATIONS,
    latestMessageId,
    activeMessageId,
  };
}

export const DEMO_FIXTURE_ROOM: Readonly<Record<DemoFixtureStateId, DemoFixtureRoomState>> = Object.freeze({
  // Step 1-3: the disputed point with an open, unanswered source ask.
  disputed: state([ROOT, CLAIM, ASK], BASE_TAGS, DEMO_MSG.ask, DEMO_MSG.claim),

  // ask_source: the viewer logs their own source request. The Referee Card
  // teaches on that new ask (it asks the disputed claim for a source).
  after_ask_source: state(
    [ROOT, CLAIM, ASK, VIEWER_ASK],
    { ...BASE_TAGS, [DEMO_MSG.viewerAsk]: [tag(DEMO_MSG.viewerAsk, 'source_request', T3)] },
    DEMO_MSG.viewerAsk,
    DEMO_MSG.viewerAsk,
  ),

  // add_evidence: a source is supplied → the source debt on the claim
  // resolves (its open-debt count drops). The card teaches on the new
  // evidence move, which now carries the source.
  after_add_evidence: state([ROOT, CLAIM, ASK, EVIDENCE], BASE_TAGS, DEMO_MSG.evidence, DEMO_MSG.evidence),

  // narrow: the claim is narrowed in scope via a `narrow_scope` concession.
  after_narrow: state(
    [ROOT, CLAIM, ASK, NARROW],
    { ...BASE_TAGS, [DEMO_MSG.narrow]: [tag(DEMO_MSG.narrow, 'narrow_scope', T3)] },
    DEMO_MSG.narrow,
    DEMO_MSG.narrow,
  ),

  // branch: a side issue opens on its own lane off the root; the mainline
  // claim (and its open source debt) is preserved. The card teaches on the
  // new branch move.
  after_branch: state([ROOT, CLAIM, ASK, BRANCH], BASE_TAGS, DEMO_MSG.branch, DEMO_MSG.branch),
});

// ── Composer-shaped fixture objects (for the REAL OneBox mount) ─

const RESOLUTION =
  'Our town library should stay open until 9 pm on weeknights.';

/**
 * A full `Debate` for the demo composer. The real OneBox / ArgumentComposer
 * read `debate.resolution` etc.; this literal supplies them with no network,
 * no row, no credentials.
 */
export const DEMO_DEBATE: Debate = Object.freeze({
  id: DEMO_ROOM_ID,
  createdBy: DEMO_VIEWER_ID,
  title: DEMO_TITLE,
  resolution: RESOLUTION,
  description: '',
  status: 'open',
  constitutionId: 'demo-constitution',
  createdAt: T0,
  updatedAt: T0,
  myParticipantSide: 'affirmative',
  visibility: 'public',
});

/**
 * The disputed sub-claim shaped as an `ArgumentRow` — the demo composer's
 * reply target (the node every demo move acts on). Derived from `CLAIM`.
 */
export const DEMO_PARENT_ARGUMENT: ArgumentRow = Object.freeze({
  id: DEMO_MSG.claim,
  debateId: DEMO_ROOM_ID,
  parentId: DEMO_MSG.root,
  authorId: DEMO_VIEWER_ID,
  argumentType: 'rebuttal',
  side: 'negative',
  body: CLAIM_BODY,
  depth: 1,
  status: 'posted',
  targetExcerpt: null,
  disagreementAxis: null,
  railPayload: {},
  clientValidation: {},
  serverValidation: {},
  clientSubmissionId: null,
  createdAt: T1,
  updatedAt: T1,
});

/** Every authored user-facing string in the fixture (fed to the ban-list test). */
export const ALL_DEMO_FIXTURE_STRINGS: ReadonlyArray<string> = Object.freeze([
  DEMO_TITLE,
  ROOT_BODY,
  CLAIM_BODY,
  ASK_BODY,
  VIEWER_ASK_BODY,
  EVIDENCE_BODY,
  NARROW_BODY,
  BRANCH_BODY,
  EVIDENCE.attachedEvidence?.[0]?.label ?? '',
  EVIDENCE.attachedEvidence?.[0]?.sourceText ?? '',
]);
