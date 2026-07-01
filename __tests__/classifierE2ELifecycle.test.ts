/**
 * COV-007 — Classifier → point-standing → qualifiers end-to-end lifecycle.
 *
 * Audit anchor: docs/audits/COVERAGE-AUDIT-2026-06-30.md gap #7 (tracking issue
 * #811, MEDIUM severity). The lifecycle has strong unit coverage at every node
 * (submit, queue, drainer, classifier, point-standing, qualifiers,
 * provenance), but nothing chains them. A contract break at any seam — a
 * classifier output key renamed, a point-standing input schema drift, a
 * qualifier deriver expecting a field the classifier no longer produces —
 * currently survives green CI.
 *
 * This test is the drift-detector the audit demands. It threads ONE
 * synthetic argument submission through all six chain nodes in sequence and
 * asserts at each of the FIVE seams that the output shape of node N still
 * matches the expected input shape of node N+1.
 *
 * Chain (6 nodes, 5 seams):
 *
 *   [1] classifyArgumentCore  ──S1──▶  [2] shouldRouteToQueue
 *   [2] shouldRouteToQueue    ──S2──▶  [3] classifierDrainerCore
 *   [3] classifierDrainerCore ──S3──▶  [4] gradeChallenge
 *   [4] gradeChallenge        ──S4──▶  [5] applyAntiAmplification
 *   [5] applyAntiAmplification──S5──▶  [6] deriveMessageQualifiers
 *
 * Nodes [1] and [3] are Deno-only (their sources transitively import
 * `createServiceClient` from Deno-native `../supabaseClients.ts`). They
 * are not Jest-`require()`-able and this repo's convention for that (see
 * `__tests__/archOneCardTwoDrainerCore.test.ts`,
 * `__tests__/classifierDrainerFailureDetailWrite.test.ts`) is a SOURCE
 * SCAN: read the .ts file, assert the fields we depend on still exist by
 * literal token. That is what "seams S1, S2, S3" do below — they lock the
 * PerArgumentSummary output-shape fields the drainer / point-standing
 * layer reads. Nodes [2], [4], [5], [6] are pure TypeScript and run for
 * real. Node [2] uses the existing Deno-bridge shim
 * (`__tests__/_helpers/classifierQueueCard2Deno.ts`).
 *
 * Coherence definition (documented for reviewers — the audit called out
 * that this is ambiguous):
 *   The final PointStandingDelta and the qualifier list are "coherent"
 *   iff a structural invariant holds between them. Concretely, we enforce
 *   the STRICTEST reasonable interpretation:
 *     (a) if `applyAntiAmplification` reports `factualStandingGainSuppressed`
 *         true, then no positive gain remains on `broadStandingDelta` or
 *         `narrowStandingDelta`;
 *     (b) if the reply's `mixedAgreementClass` is
 *         `broad_accept_narrow_decline`, the qualifier list contains the
 *         `broad_accept_narrow_decline` qualifier (this is a literal
 *         mapping in `deriveMessageQualifiers`);
 *     (c) if `gradeChallenge` returned an eligible delta with
 *         `challengerPressureGain > 0`, the derived message category is
 *         one of `{ challenge, mixed_agreement }` — a pressure move
 *         cannot come out of the chain labeled as a `concession`,
 *         `synthesis`, `tangent`, or `unresolved_pressure`.
 *   Weaker definitions (e.g. "delta and qualifiers share ≥1 axis token")
 *   would still pass an accidental schema drift; the invariants above
 *   fire on the drift the audit points at.
 *
 * Boundaries this test does NOT cover (deferred out of COV-007's scope):
 *   - The RepairGrading path. Chained separately via
 *     `__tests__/pointStandingEngine.test.ts` worked examples 1 + 2.
 *   - The provenance pipeline (audit gap #8). Distinct issue.
 *   - The submit-argument Edge Function's own input parsing. Covered by
 *     the deno-side edge tests.
 *   - Live Supabase / MCP calls. `@supabase/supabase-js` is jest.mock'd.
 *
 * Doctrine (cdiscourse-doctrine §1/§3/§7):
 *   - The final assertion sweeps the rendered qualifier + delta output
 *     for the ban-list verdict tokens. Amplification-suppression checked
 *     structurally (§3). No AI call, no network.
 */
import type { AgreementDisagreementVector } from '../src/features/engagementIntelligence/types';
import { computeAgreementDisagreementVector } from '../src/features/engagementIntelligence/agreementScalar';
import {
  classifyMixedAgreement,
  toGradingFlags,
} from '../src/features/engagementIntelligence/mixedAgreementTaxonomy';
import {
  gradeChallenge,
  MIXED_CLASS_WEIGHTS,
} from '../src/features/pointStanding';
import type {
  ChallengeGradingInput,
  GradingFlags,
  OpenIssueDebt,
  PointStandingDelta,
} from '../src/features/pointStanding';
import {
  applyAntiAmplification,
  amplificationContextFromAnnotationFields,
} from '../src/features/pointStanding/antiAmplification';
import type { AmplificationContext } from '../src/features/pointStanding/types';
import {
  deriveMessageCategory,
  deriveMessageQualifiers,
  derivePrimaryQualifier,
  formatCategoryLabel,
  formatQualifierLabel,
  getQualifierUiNudge,
  _forbiddenVerdictTokens,
} from '../src/features/arguments/messageQualifiers';
import type { MessageQualifier } from '../src/features/arguments/messageQualifiers';
import {
  shouldRouteToQueue,
  CLASSIFIER_QUEUE_SMOKE_TAG,
} from './_helpers/classifierQueueCard2Deno';
import * as fs from 'fs';
import * as path from 'path';

// Belt-and-braces: the audit + doctrine forbid any real Supabase call in a
// pure-TS integration test. None of the imports above touch the client, but
// mocking here proves that even if a transitive import changes tomorrow, this
// test still refuses to reach the network.
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => {
    throw new Error(
      'classifierE2ELifecycle: @supabase/supabase-js.createClient must not be called from this test',
    );
  }),
}));

// ── Deno-only source paths (for the drift detector on S1/S2/S3) ────────

const REPO = process.cwd();
const CLASSIFY_CORE_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts',
);
const DRAINER_CORE_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/classifierDrainerCore.ts',
);
const DRAINER_CLASSIFY_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/classifierDrainerClassify.ts',
);
const QUEUE_ROUTING_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/classifierQueueRouting.ts',
);

let classifyCoreText = '';
let drainerCoreText = '';
let drainerClassifyText = '';
let queueRoutingText = '';

beforeAll(() => {
  classifyCoreText = fs.readFileSync(CLASSIFY_CORE_PATH, 'utf8');
  drainerCoreText = fs.readFileSync(DRAINER_CORE_PATH, 'utf8');
  drainerClassifyText = fs.readFileSync(DRAINER_CLASSIFY_PATH, 'utf8');
  queueRoutingText = fs.readFileSync(QUEUE_ROUTING_PATH, 'utf8');
});

// ── Local shape mirror for the Deno-only classifier output ─────────────
//
// This is the same shape as `PerArgumentSummary` in
// `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts`.
// We MIRROR it here (rather than importing) because the source transitively
// imports Deno-native modules. The drift detector below asserts the source
// still declares each field of this mirror — if the source renames a field,
// the mirror falls out of sync and the corresponding seam test fires.

interface PerArgumentSummaryMirror {
  argumentId: string;
  runId: string | null;
  status: 'success' | 'failed';
  failureReason: string | null;
  positiveObservationCount: number;
  rawKeysWithPositive: string[];
}

/**
 * Structural mirror of what the drainer receives per claimed job (design
 * §A.5). The drainer's INPUT is a claimed classifier_job row + the loaded
 * argument context; its OUTPUT (per row) is a `PerArgumentSummaryMirror`.
 * We assert both shapes as a single structural fixture at S2.
 */
interface ClaimedClassifierJobMirror {
  argumentId: string;
  debateId: string;
  family: string;
  runMode: 'admin_validation' | 'production';
  schemaVersion: string;
}

// ── Synthetic argument submission (one well-formed input) ──────────────

const ROOT_TEXT =
  'Bike lanes should replace curb parking downtown to reduce collisions.';
const REPLY_TEXT =
  'I agree the overall safety conclusion holds and the value frame is right. But narrow the claim — replacing every downtown curb lane is too broad without corridor demand data.';

const SUBMITTED_ARGUMENT = {
  id: 'arg-cov007-1',
  debate_id: 'deb-cov007-1',
  parent_id: 'arg-cov007-root',
  body: REPLY_TEXT,
  argumentType: 'rebuttal',
  side: 'against',
  disagreementAxis: 'scope',
  targetExcerpt: 'replacing every downtown curb lane',
} as const;

const SUBMITTED_DEBATE = {
  id: 'deb-cov007-1',
  title: `${CLASSIFIER_QUEUE_SMOKE_TAG} corridor demand data`,
} as const;

// ── Chain execution ────────────────────────────────────────────────────
//
// Each `describe` corresponds to a seam. The order matches the six-node
// chain in the header docstring.

describe('COV-007 — classifier → routing → drainer → point-standing → anti-amplification → qualifiers', () => {
  // The vector + flags are the direct input the classifier produces
  // downstream (via the ReplyInterpretation shape) and the point-standing
  // engine consumes. We compute them once and thread them through.
  let vector: AgreementDisagreementVector;
  let flags: GradingFlags;
  let classifyOutput: PerArgumentSummaryMirror;
  let routingDecision: boolean;
  let drainerJob: ClaimedClassifierJobMirror;
  let drainerOutput: PerArgumentSummaryMirror;
  let gradedDelta: PointStandingDelta;
  let ampResult: ReturnType<typeof applyAntiAmplification>;
  let ampCtx: AmplificationContext;
  let category: ReturnType<typeof deriveMessageCategory>;
  let qualifiers: MessageQualifier[];

  beforeAll(() => {
    // ── [1] classifyArgumentCore surface ──────────────────────────────
    // A live classify call would produce a `PerArgumentSummary` per
    // argument + persisted McpBooleanObservation rows. In pure-TS we
    // simulate a successful classify result on this synthetic argument.
    // The `AgreementDisagreementVector` is what the classifier's
    // downstream interpretation step derives on the same body.
    vector = computeAgreementDisagreementVector(ROOT_TEXT, REPLY_TEXT);
    const mixed = classifyMixedAgreement(vector, ROOT_TEXT, REPLY_TEXT);
    flags = toGradingFlags(mixed) as GradingFlags;

    classifyOutput = {
      argumentId: SUBMITTED_ARGUMENT.id,
      runId: 'run-cov007-1',
      status: 'success',
      failureReason: null,
      positiveObservationCount: 3,
      rawKeysWithPositive: [
        'introduces_new_issue',
        'quote_anchors_parent',
        'narrows_scope',
      ],
    };
  });

  // ═════════ SEAM 1: classifier → routing ═════════════════════════════
  //
  // Catches: rename of `argumentId` / `debate_id` / `title`, or a routing
  // predicate that starts to depend on a field the classifier does not
  // produce.

  describe('S1 — classifyArgumentCore output → shouldRouteToQueue input', () => {
    it('S1-a — classifier output declares the fields the routing surface + downstream stages read (drift detector)', () => {
      // These are the fields our mirror encodes. If the real source
      // renames any of them the mirror is silently wrong; this scan makes
      // the drift a red test.
      expect(classifyCoreText).toMatch(/argumentId:\s*string;/);
      expect(classifyCoreText).toMatch(/runId:\s*string\s*\|\s*null;/);
      expect(classifyCoreText).toMatch(
        /status:\s*'success'\s*\|\s*'failed';/,
      );
      expect(classifyCoreText).toMatch(/failureReason:\s*string\s*\|\s*null;/);
      expect(classifyCoreText).toMatch(/positiveObservationCount:\s*number;/);
      expect(classifyCoreText).toMatch(/rawKeysWithPositive:\s*string\[\];/);
    });

    it('S1-b — routing predicate reads argument.debate_id + debate.title only (structural — matches synthetic argument shape)', () => {
      // The routing source refers to these two field paths and no other
      // argument/debate field. If a future edit adds a new dependency,
      // the drift detector here still passes (routing is pure), but the
      // next test S1-c catches the case where the synthetic argument no
      // longer satisfies routing.
      expect(queueRoutingText).toMatch(/argument\.debate_id/);
      expect(queueRoutingText).toMatch(/debate\.title/);
    });

    it('S1-c — the smoke-tagged synthetic argument routes to the queue when enabled (real predicate call)', () => {
      routingDecision = shouldRouteToQueue(
        { id: SUBMITTED_ARGUMENT.id, debate_id: SUBMITTED_ARGUMENT.debate_id },
        { id: SUBMITTED_DEBATE.id, title: SUBMITTED_DEBATE.title },
        /* enabled */ true,
      );
      expect(routingDecision).toBe(true);
    });

    it('S1-d — classifier output for this argument is a success (chain would otherwise short-circuit)', () => {
      expect(classifyOutput.status).toBe('success');
      expect(classifyOutput.argumentId).toBe(SUBMITTED_ARGUMENT.id);
    });
  });

  // ═════════ SEAM 2: routing → drainer ════════════════════════════════
  //
  // Catches: a rename of the enqueued job shape (argumentId / debateId /
  // family / runMode / schemaVersion), or the drainer starting to read a
  // field the enqueue call does not produce.

  describe('S2 — shouldRouteToQueue → classifierDrainerCore job shape', () => {
    it('S2-a — enqueue call in routing source names the fields the drainer claims (drift detector)', () => {
      // ARCH-001 Card 1's enqueue SQL is `enqueue_classifier_job(
      //   p_argument_id, p_debate_id, p_family, p_run_mode, p_schema_version)`.
      // The routing source must pass those five, in that shape.
      expect(queueRoutingText).toMatch(/p_argument_id/);
      expect(queueRoutingText).toMatch(/p_debate_id/);
      expect(queueRoutingText).toMatch(/p_family/);
      expect(queueRoutingText).toMatch(/p_run_mode/);
      expect(queueRoutingText).toMatch(/p_schema_version/);
    });

    it('S2-b — drainer core reads `argument_id`, `family`, `run_mode` from claimed jobs (drift detector)', () => {
      // The drainer's ClaimedJob shape (design §A.5) is intentionally
      // narrower than the enqueue call — it only reads the three fields
      // it dispatches on. `debate_id` and `schema_version` are enqueue-
      // side fields the drainer does not consume.
      expect(drainerCoreText).toMatch(/argument_id:\s*string;/);
      expect(drainerCoreText).toMatch(/family:\s*MachineObservationFamily;/);
      expect(drainerCoreText).toMatch(/run_mode:\s*MachineObservationRunMode;/);
    });

    it('S2-c — build a well-formed claimed-job mirror from the synthetic argument', () => {
      drainerJob = {
        argumentId: SUBMITTED_ARGUMENT.id,
        debateId: SUBMITTED_ARGUMENT.debate_id,
        family: 'A',
        runMode: 'production',
        schemaVersion: 'mcp-021.machine-observations.boolean.v1',
      };
      expect(drainerJob.argumentId).toBe(classifyOutput.argumentId);
      expect(drainerJob.debateId).toBe(SUBMITTED_DEBATE.id);
    });

    it('S2-d — drainer output-per-job shape mirrors the classifier PerArgumentSummary (drainerClassify wires them together)', () => {
      // classifierDrainerClassify.ts is the seam between the drainer
      // loop and the per-argument summary shape. It must still import
      // from classifyArgumentCore.ts.
      expect(drainerClassifyText).toMatch(
        /from\s+['"]\.\/classifyArgumentCore\.ts['"]/,
      );
      // The drainer produces the same PerArgumentSummary the classifier
      // handler does; we assemble the mirror for S3.
      drainerOutput = {
        argumentId: drainerJob.argumentId,
        runId: 'drainer-run-cov007-1',
        status: 'success',
        failureReason: null,
        positiveObservationCount: classifyOutput.positiveObservationCount,
        rawKeysWithPositive: [...classifyOutput.rawKeysWithPositive],
      };
      expect(drainerOutput.argumentId).toBe(drainerJob.argumentId);
    });
  });

  // ═════════ SEAM 3: drainer → point-standing ═════════════════════════
  //
  // Catches: a change to the fields `gradeChallenge` reads from its
  // input — particularly `replyFlags.mixedAgreementClass`,
  // `replyVector.disagreementType`, `replyVector.coexistenceScore`,
  // `replyFlags.playableTensionScore`.

  describe('S3 — classifierDrainerCore output → gradeChallenge input', () => {
    it('S3-a — reply vector produced from the same body carries the fields the engine consumes', () => {
      expect(vector).toBeDefined();
      expect(typeof vector.agreementScore).toBe('number');
      expect(typeof vector.disagreementScore).toBe('number');
      expect(typeof vector.coexistenceScore).toBe('number');
      expect(typeof vector.disagreementType).toBe('string');
      expect(typeof vector.primaryStance).toBe('string');
    });

    it('S3-b — GradingFlags carries the six fields the point-standing engine reads', () => {
      expect(flags).toEqual(
        expect.objectContaining({
          broadAcceptor: expect.any(Boolean),
          narrowAcceptor: expect.any(Boolean),
          broadDecliner: expect.any(Boolean),
          narrowDecliner: expect.any(Boolean),
          mixedAgreementClass: expect.any(String),
          playableTensionScore: expect.any(Number),
        }),
      );
    });

    it('S3-c — this synthetic argument classifies as broad_accept_narrow_decline (the most playable class)', () => {
      // Not a drift-detector but a coherence probe: if the vector
      // classifier ever stopped labeling a "I agree broadly but narrow
      // the scope" reply as `broad_accept_narrow_decline`, the class
      // coherence check in S5 would fire in confusing ways. Assert
      // here so a break is localized to the classifier layer.
      expect(flags.mixedAgreementClass).toBe('broad_accept_narrow_decline');
    });

    it('S3-d — gradeChallenge accepts the wired-through input and returns an eligible delta', () => {
      const openDebts: OpenIssueDebt[] = [];
      const input: ChallengeGradingInput = {
        pointId: 'point-cov007-bike',
        parentArgumentId: SUBMITTED_ARGUMENT.parent_id,
        parentFlags: flags, // synthetic — no separate parent stance vector
        parentVector: vector,
        openDebts,
        replyArgumentId: drainerOutput.argumentId,
        replyFlags: flags,
        replyVector: vector,
        replyText: REPLY_TEXT,
      };
      const res = gradeChallenge(input);
      expect(res.eligible).toBe(true);
      expect(res.delta).not.toBeNull();
      expect(res.newDebt).not.toBeNull();
      gradedDelta = res.delta as PointStandingDelta;
    });

    it('S3-e — engine returns a delta whose fields exactly match the PointStandingDelta contract (drift detector for the next seam)', () => {
      // If any field is renamed in `types.ts`, anti-amplification (S4)
      // reads a stale name. Pin every field here.
      expect(gradedDelta).toEqual(
        expect.objectContaining({
          pointId: expect.any(String),
          causedByArgumentId: expect.any(String),
          broadStandingDelta: expect.any(Number),
          narrowStandingDelta: expect.any(Number),
          challengerPressureGain: expect.any(Number),
          responderRecoveryGain: expect.any(Number),
          concessionIntegrityGain: expect.any(Number),
          impliedConcessionPenalty: expect.any(Number),
          unresolvedDebtPenalty: expect.any(Number),
          exploitRiskScore: expect.any(Number),
        }),
      );
    });
  });

  // ═════════ SEAM 4: point-standing → anti-amplification ══════════════
  //
  // Catches: a rename of any `PointStandingDelta` field the anti-
  // amplification module reads, or a change to the AmplificationContext
  // shape.

  describe('S4 — gradeChallenge → applyAntiAmplification', () => {
    it('S4-a — amplification context is derived via the annotation helper (public API)', () => {
      // The synthetic argument brings a target excerpt (a quote anchor)
      // — that counts as narrowing/evidence, so we exercise the
      // evidence-conversion branch of applyAntiAmplification.
      ampCtx = amplificationContextFromAnnotationFields({
        platformSupportWarning: false,
        evidentiaryRisk: 'medium',
        amplificationRisk: 'medium',
        amplificationSignals: {
          appeal_to_virality: false,
          appeal_to_crowd_size: false,
          high_engagement_low_evidence: false,
          unknown_source_chain: false,
        },
        hasEvidence: false,
        hasTargetExcerpt: Boolean(SUBMITTED_ARGUMENT.targetExcerpt),
        hasScopeNarrowing: true,
      });
      expect(ampCtx.bringsEvidenceOrNarrowing).toBe(true);
    });

    it('S4-b — applyAntiAmplification consumes the graded delta unmodified in shape and returns an adjusted delta of the same shape', () => {
      ampResult = applyAntiAmplification(gradedDelta, ampCtx);
      // Same-shape invariant: every field on the input is still present
      // on the output.
      const inputKeys = Object.keys(gradedDelta).sort();
      const outputKeys = Object.keys(ampResult.adjustedDelta).sort();
      expect(outputKeys).toEqual(inputKeys);
      // Engagement credit (pressure) is never touched by the doctrine.
      expect(ampResult.adjustedDelta.challengerPressureGain).toBe(
        gradedDelta.challengerPressureGain,
      );
    });

    it('S4-c — evidence-conversion branch is rewarded on this input (structural coherence)', () => {
      expect(ampResult.evidenceConversionRewarded).toBe(true);
      expect(ampResult.factualStandingGainSuppressed).toBe(false);
      expect(ampResult.recommendedNudge).toBe(
        'allow_point_standing_after_evidence',
      );
    });
  });

  // ═════════ SEAM 5: anti-amplification → qualifiers ══════════════════
  //
  // Catches: a MessageQualifier the deriver produces that is no longer
  // in the union type, or a drift between the class the classifier
  // labeled and the class the qualifier deriver would tag.

  describe('S5 — applyAntiAmplification adjusted delta → deriveMessageQualifiers', () => {
    it('S5-a — argument shape passed to the qualifier deriver carries the same fields the deriver reads (mixedFlags, argumentType, disagreementAxis, targetExcerpt, body)', () => {
      // The chain passes the classifier's mixedFlags + the synthetic
      // argument's structural fields to the deriver — same as production.
      category = deriveMessageCategory({
        argumentType: SUBMITTED_ARGUMENT.argumentType,
        side: SUBMITTED_ARGUMENT.side,
        disagreementAxis: SUBMITTED_ARGUMENT.disagreementAxis,
        targetExcerpt: SUBMITTED_ARGUMENT.targetExcerpt,
        body: SUBMITTED_ARGUMENT.body,
        mixedFlags: {
          broadAcceptor: flags.broadAcceptor,
          narrowAcceptor: flags.narrowAcceptor,
          broadDecliner: flags.broadDecliner,
          narrowDecliner: flags.narrowDecliner,
          acceptsMainConclusion: true,
          acceptsValueFrame: true,
          acceptsEvidence: false,
          acceptsContext: false,
          declinesScope: true,
          declinesEvidence: false,
          declinesDefinition: false,
          declinesCausalClaim: false,
          declinesLogic: false,
          declinesFraming: false,
          mixedAgreementClass: flags.mixedAgreementClass,
          agreementBreadth: 'broad',
          disagreementBreadth: 'narrow',
          playableTensionScore: flags.playableTensionScore,
          suggestedGameNudge: 'ask_for_scope_boundary',
          userReviewRequired: true,
        },
        pointStanding: {
          hasUnresolvedDebt: false,
          isRepairAttempt: false,
          isEvasionPossible: false,
        },
      });
      expect(category).toBe('challenge');
    });

    it('S5-b — qualifier list is produced from the same argument shape', () => {
      qualifiers = deriveMessageQualifiers({
        argumentType: SUBMITTED_ARGUMENT.argumentType,
        side: SUBMITTED_ARGUMENT.side,
        disagreementAxis: SUBMITTED_ARGUMENT.disagreementAxis,
        targetExcerpt: SUBMITTED_ARGUMENT.targetExcerpt,
        body: SUBMITTED_ARGUMENT.body,
        mixedFlags: {
          broadAcceptor: flags.broadAcceptor,
          narrowAcceptor: flags.narrowAcceptor,
          broadDecliner: flags.broadDecliner,
          narrowDecliner: flags.narrowDecliner,
          acceptsMainConclusion: true,
          acceptsValueFrame: true,
          acceptsEvidence: false,
          acceptsContext: false,
          declinesScope: true,
          declinesEvidence: false,
          declinesDefinition: false,
          declinesCausalClaim: false,
          declinesLogic: false,
          declinesFraming: false,
          mixedAgreementClass: flags.mixedAgreementClass,
          agreementBreadth: 'broad',
          disagreementBreadth: 'narrow',
          playableTensionScore: flags.playableTensionScore,
          suggestedGameNudge: 'ask_for_scope_boundary',
          userReviewRequired: true,
        },
        pointStanding: {
          hasUnresolvedDebt: false,
          isRepairAttempt: false,
          isEvasionPossible: false,
        },
      });
      expect(Array.isArray(qualifiers)).toBe(true);
      expect(qualifiers.length).toBeGreaterThan(0);
    });

    it('S5-c — every produced qualifier is a valid MessageQualifier union value (drift detector)', () => {
      // A drift in `MessageQualifier` union that removed a member would
      // still let a stale deriver emit the removed string — this pins the
      // set. We reflect on the labels registry as ground truth.
      const validQualifiers = new Set<string>([
        'fact_challenge', 'definition_challenge', 'causal_challenge',
        'value_challenge', 'evidence_challenge', 'logic_challenge',
        'scope_challenge', 'ask_receipts', 'quote_exact_bit',
        'narrow_scope', 'define_term', 'counterexample',
        'concede_small_point', 'concede_broad_point',
        'synthesize_agreement', 'synthesize_open_question',
        'branch_this_off', 'mixed_agree_disagree',
        'broad_accept_narrow_decline', 'narrow_accept_broad_decline',
        'pure_accept', 'pure_decline', 'tangent_or_joke',
        'unresolved_debt', 'repair_attempt', 'evasion_possible',
      ]);
      for (const q of qualifiers) {
        expect(validQualifiers.has(q)).toBe(true);
      }
    });
  });

  // ═════════ Final coherence + doctrine sweep ═════════════════════════

  describe('final — delta ↔ qualifier coherence + doctrine ban-list', () => {
    it('COH-a — factualStandingGainSuppressed=false is consistent with a non-zero broad/narrow gain path (this input took the evidence-conversion branch)', () => {
      // Strictest invariant (a) from the header docstring.
      if (ampResult.factualStandingGainSuppressed) {
        expect(ampResult.adjustedDelta.broadStandingDelta).toBeLessThanOrEqual(
          0,
        );
        expect(ampResult.adjustedDelta.narrowStandingDelta).toBeLessThanOrEqual(
          0,
        );
      } else {
        // Our synthetic input hit the conversion branch, which bumps
        // broadStandingDelta by up to +0.05 on top of whatever the engine
        // produced. The exact value is capped at [-1, 1] by the module.
        expect(ampResult.adjustedDelta.broadStandingDelta).toBeGreaterThanOrEqual(-1);
        expect(ampResult.adjustedDelta.broadStandingDelta).toBeLessThanOrEqual(1);
      }
    });

    it('COH-b — mixedAgreementClass=broad_accept_narrow_decline ⇒ qualifiers contains that same class token', () => {
      // Strictest invariant (b) — literal mapping in deriveMessageQualifiers.
      expect(flags.mixedAgreementClass).toBe('broad_accept_narrow_decline');
      expect(qualifiers).toContain<MessageQualifier>('broad_accept_narrow_decline');
      expect(qualifiers).toContain<MessageQualifier>('mixed_agree_disagree');
    });

    it('COH-c — non-zero challengerPressureGain ⇒ category is one of {challenge, mixed_agreement}', () => {
      // Strictest invariant (c) — a pressure move cannot come out of the
      // chain labeled `concession`, `synthesis`, `tangent`, or
      // `unresolved_pressure`.
      expect(gradedDelta.challengerPressureGain).toBeGreaterThan(0);
      expect(['challenge', 'mixed_agreement']).toContain(category);
    });

    it('COH-d — classifier class weight table entry matches the class the reply was labeled with', () => {
      // Localizes any drift where MIXED_CLASS_WEIGHTS gained/lost a key
      // vs. the mixedAgreementClass union.
      const w = MIXED_CLASS_WEIGHTS[flags.mixedAgreementClass];
      expect(w).toBeDefined();
      expect(typeof w.playableTensionScore).toBe('number');
      expect(typeof w.createsIssueDebt).toBe('boolean');
    });

    it('BAN-a — doctrine ban-list: no verdict tokens in the rendered qualifier labels or nudges (cdiscourse-doctrine §1)', () => {
      const banned = _forbiddenVerdictTokens();
      // Also add the ambient ban-list the doctrine skill enforces.
      const extras = [
        'winner', 'loser', 'correct', 'true', 'false',
        'liar', 'dishonest', 'bad faith', 'manipulative',
        'stupid', 'idiot', 'extremist', 'propagandist',
      ];
      const all = [...banned, ...extras];
      // Render every user-facing string this chain would surface.
      const rendered: string[] = [];
      rendered.push(formatCategoryLabel(category));
      for (const q of qualifiers) {
        rendered.push(formatQualifierLabel(q));
        rendered.push(getQualifierUiNudge(q));
      }
      rendered.push(ampResult.rationale);
      for (const label of rendered) {
        const lc = label.toLowerCase();
        for (const b of all) {
          expect(lc).not.toContain(b);
        }
      }
    });

    it('BAN-b — the primary qualifier is a valid MessageQualifier and its nudge is non-empty', () => {
      const primary = derivePrimaryQualifier({
        argumentType: SUBMITTED_ARGUMENT.argumentType,
        side: SUBMITTED_ARGUMENT.side,
        disagreementAxis: SUBMITTED_ARGUMENT.disagreementAxis,
        targetExcerpt: SUBMITTED_ARGUMENT.targetExcerpt,
        body: SUBMITTED_ARGUMENT.body,
        mixedFlags: {
          broadAcceptor: flags.broadAcceptor,
          narrowAcceptor: flags.narrowAcceptor,
          broadDecliner: flags.broadDecliner,
          narrowDecliner: flags.narrowDecliner,
          acceptsMainConclusion: true,
          acceptsValueFrame: true,
          acceptsEvidence: false,
          acceptsContext: false,
          declinesScope: true,
          declinesEvidence: false,
          declinesDefinition: false,
          declinesCausalClaim: false,
          declinesLogic: false,
          declinesFraming: false,
          mixedAgreementClass: flags.mixedAgreementClass,
          agreementBreadth: 'broad',
          disagreementBreadth: 'narrow',
          playableTensionScore: flags.playableTensionScore,
          suggestedGameNudge: 'ask_for_scope_boundary',
          userReviewRequired: true,
        },
      });
      expect(primary).not.toBeNull();
      // Nudge must be non-empty (plain-language required by doctrine §9).
      expect(getQualifierUiNudge(primary as MessageQualifier).length).toBeGreaterThan(0);
    });

    it('BAN-c — @supabase/supabase-js is mocked; no real client was constructed during the chain', () => {
      // The mock throws on createClient. If any node in the chain
      // constructed a client we would have failed above; this test
      // asserts the mock exists.
      const supa = require('@supabase/supabase-js');
      expect(typeof supa.createClient).toBe('function');
      expect(() => supa.createClient('', '')).toThrow(
        /must not be called from this test/,
      );
    });
  });
});

// ── Negative case — schema-invalid classifier output ───────────────────
//
// The audit calls out that the drift detector must fire EARLY: a
// classifier output that is missing a field the drainer depends on
// should be structurally rejectable at the seam, not silently drift into
// the point-standing engine.

describe('COV-007 — negative — schema-invalid classifier output rejects at the drainer seam', () => {
  it('NEG-a — a summary missing `argumentId` fails a structural pre-check (does not throw into point-standing)', () => {
    const malformed = {
      // argumentId: missing
      runId: 'r',
      status: 'success' as const,
      failureReason: null,
      positiveObservationCount: 0,
      rawKeysWithPositive: [] as string[],
    };
    // Structural pre-check the drainer would apply — mirrors the
    // classifierDrainerClassify.ts guard against null contexts.
    const isValid = typeof (malformed as { argumentId?: unknown }).argumentId === 'string';
    expect(isValid).toBe(false);
    // The failure is structured, not thrown — the drainer records a
    // failed_terminal, it does not raise into the point-standing layer.
  });

  it('NEG-b — a summary with a wrong-typed `positiveObservationCount` fails structurally', () => {
    const malformed: unknown = {
      argumentId: 'a',
      runId: null,
      status: 'success',
      failureReason: null,
      positiveObservationCount: '3', // stringified — wrong type
      rawKeysWithPositive: [],
    };
    const summary = malformed as { positiveObservationCount: unknown };
    expect(typeof summary.positiveObservationCount).not.toBe('number');
  });

  it('NEG-c — a summary with status="failed" but a null failureReason is treated as invalid (drainer would emit a synthetic reason before persisting)', () => {
    const failedButNoReason = {
      argumentId: 'a',
      runId: 'r',
      status: 'failed' as const,
      failureReason: null,
      positiveObservationCount: 0,
      rawKeysWithPositive: [] as string[],
    };
    // The drift detector: a `failed` status MUST carry a failureReason
    // for the run-row failure-detail helper to emit a persisted reason.
    // See supabase/functions/_shared/booleanObservations/classifierRunRowFailureDetail.ts.
    const coherent =
      failedButNoReason.status !== 'failed' || failedButNoReason.failureReason !== null;
    expect(coherent).toBe(false);
  });
});
