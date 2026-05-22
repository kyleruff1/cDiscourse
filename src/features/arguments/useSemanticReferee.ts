/**
 * MCP-019 — useSemanticReferee: the room hook that threads ONE
 * `SemanticRefereePacket` from a live argument room in MOCK mode.
 *
 * LOCATION NOTE (implementer deviation from MCP-019 §5): this hook lives in
 * `src/features/arguments/` — the room/application layer — NOT in
 * `src/features/semanticReferee/`. The design §5 named the latter, but the
 * `semanticReferee/` directory is a FOUNDATION layer and the existing test
 * `__tests__/refereeBannerForbiddenImports.test.ts` enforces that no file in
 * it may import from `refereeBanners/`. This hook consumes `refereeBanners`
 * AND `semanticOverride` AND `edgeFunctions`, so it is a room-layer module by
 * nature (the same reasoning §5 used to place `SemanticOverrideChoiceSheet`
 * in `arguments/`). See the design doc's "Implementer note" addendum.
 *
 * The hook owns all semantic-referee state for a room session:
 *   - `clientCacheRef` — a room-scoped MCP-012 `SemanticPacketCache` (Defect 3);
 *   - `repeatedSignal` — the in-memory, UX-only `RepeatedOverrideSignal`;
 *   - `refereeStateByMoveId` — one `RefereeMoveState` per classified move;
 *   - `overrideRecordsByMoveId` — append-only in-memory override records.
 *
 * `onMovePosted` is the ONLY async path. It runs, in order: redact → cache
 * key → cache lookup → `evaluateTrigger` → `planClassifierBatches` →
 * per-batch `isWithinBudget` → `classifyMove` (one call per batch) → merge
 * binaries → `selectBanner` + `evaluateSemanticOverridePrompt` → store.
 *
 * Doctrine (MCP-019 §2 — every line is a reviewer-enforced rule):
 *   - The ONLY outbound call is `classifyMove → invoke('semantic-referee')`.
 *     No provider SDK, no `fetch` to a model host. AI never runs on the client.
 *   - `{ enabled: false }` for ANY of the 9 reasons, an `ok:false` wrapper
 *     error, and a thrown rejection are ALL collapsed into a single inert
 *     `'fallback'` state. The hook exposes NO error field — there is
 *     intentionally no way for a consumer to render an error.
 *   - `classifyMove` runs only AFTER `submit-argument` posted the move
 *     (the `post_submit` trigger). The hook never gates the composer.
 *   - A cache hit fires NO `classifyMove` call at all.
 *   - The override choice writes only an in-memory `SemanticOverrideRecord`;
 *     no scoring path, no `flags` row.
 *
 * No `console.log`, no `console.error` — a degraded result is silent.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { classifyMove } from '../../lib/edgeFunctions';
import type {
  ClassifyMoveRoomContext,
  ClassifyMoveFunctionResult,
} from '../../lib/edgeFunctions';
import { evaluateTrigger } from '../semanticReferee/triggerGates';
import type { SemanticClassificationMode } from '../semanticReferee/triggerGates';
import { planClassifierBatches } from '../semanticReferee/classifierBatching';
import { SemanticPacketCache } from '../semanticReferee/semanticCache';
import { buildSemanticCacheKey } from '../semanticReferee/semanticRefereeCacheKey';
import { isWithinBudget } from '../semanticReferee/tokenBudget';
import type {
  SemanticBinarySample,
  SemanticRefereePacket,
} from '../semanticReferee/semanticRefereeTypes';
import { redactBody } from '../semanticReferee/clientRedaction';
import {
  POST_SUBMIT_CLASSIFIER_SET,
  SEMANTIC_CLASSIFICATION_MODE_DEFAULT,
  SEMANTIC_REFEREE_CLIENT_ATTEMPT_DEFAULT,
  buildPostSubmitTriggerInput,
  mapParticipantSideToActorRole,
} from '../semanticReferee/semanticTriggerInput';
import {
  buildBannerSelectionInputFromPacket,
} from '../refereeBanners/bannerSelectionInputFromPacket';
import { selectBanner } from '../refereeBanners/selectBanner';
import type { BannerSelectionResult } from '../refereeBanners/types';
import { evaluateSemanticOverridePrompt } from '../semanticOverride/overrideTriggerModel';
import {
  buildSemanticOverrideRecord,
  bumpRepeatedOverrideSignal,
  emptyRepeatedOverrideSignal,
} from '../semanticOverride/overrideRecordModel';
import type {
  RepeatedOverrideSignal,
  SemanticOverrideActorRole,
  SemanticOverrideLane,
  SemanticOverridePrompt,
  SemanticOverrideRecord,
} from '../semanticOverride/types';

// ── Public state shapes ───────────────────────────────────────────

/**
 * The lifecycle of one move's classification.
 *   - `idle`     — never classified (no entry; the default `getMoveState`).
 *   - `pending`  — a `classifyMove` call is in flight.
 *   - `ready`    — a packet arrived; `banner` / `overridePrompt` are derived.
 *   - `fallback` — every outcome failed (disabled / error / rejection). It
 *                  renders IDENTICALLY to `idle` — nothing.
 */
export type RefereeMoveStatus = 'idle' | 'pending' | 'ready' | 'fallback';

/** Per-move semantic state. `banner` / `overridePrompt` are doctrine-safe projections. */
export interface RefereeMoveState {
  status: RefereeMoveStatus;
  /** Present only on `ready`. Never leaves the hook except via `banner` / `overridePrompt`. */
  packet?: SemanticRefereePacket;
  /** MCP-014 selection — `banner: null` is the common, correct case. */
  banner: BannerSelectionResult;
  /** MCP-015 prompt — `shouldOffer: false` unless a low-confidence routing binary appears. */
  overridePrompt: SemanticOverridePrompt;
}

/** Arguments to `onMovePosted` — the just-posted move + its room context. */
export interface OnMovePostedArgs {
  roomId: string;
  moveId: string;
  parentId?: string | null;
  /** The just-posted move's body — redacted client-side before it leaves the device. */
  body: string;
  /** The parent move's body, if any — also redacted. */
  parentBody?: string | null;
  /** The room's participant side ('affirmative' | 'negative' | 'observer' | 'moderator'). */
  participantSide?: string | null;
  /** Room context the boundary needs to interpret the move. */
  roomContext?: ClassifyMoveRoomContext;
  /** Optional prompt-version hint; defaults to the v0 prompt version. */
  promptVersionHint?: string;
}

/** A confirmed override choice handed to `confirmOverride`. */
export interface ConfirmOverrideArgs {
  chosenLane: SemanticOverrideLane;
  assertsAnswersParent: boolean;
  /** Caller-supplied — the viewer making the override. */
  overriddenByUserId: string;
  /** The viewer's participant side — maps to the override actor role. */
  participantSide?: string | null;
  /** ISO-8601 timestamp; defaults to `new Date().toISOString()`. */
  at?: string;
}

/** Construction options — for the room shell and for tests. */
export interface UseSemanticRefereeOptions {
  /** Client intent flag. Defaults to `SEMANTIC_REFEREE_CLIENT_ATTEMPT_DEFAULT` (true). */
  featureLayerEnabled?: boolean;
  /** Client room mode. Defaults to `SEMANTIC_CLASSIFICATION_MODE_DEFAULT`. */
  semanticClassificationMode?: SemanticClassificationMode;
}

/** The hook's public surface. NOTE: there is intentionally NO error field. */
export interface UseSemanticRefereeResult {
  /** Classify a just-posted move. Fire-and-forget from the caller's view. */
  onMovePosted: (args: OnMovePostedArgs) => Promise<void>;
  /** The per-move state. An unknown move returns an inert `idle` state. */
  getMoveState: (moveId: string) => RefereeMoveState;
  /** Record a confirmed override choice for a move (in-memory only). */
  confirmOverride: (moveId: string, choice: ConfirmOverrideArgs) => void;
  /** The append-only override records for a move (in-memory). */
  getOverrideRecords: (moveId: string) => readonly SemanticOverrideRecord[];
  /** The in-memory repeated-override signal (UX copy only). */
  repeatedSignal: RepeatedOverrideSignal;
}

// ── Internal constants / helpers ──────────────────────────────────

/** The default prompt-version hint — matches MCP-011's fixture prompt version. */
const PROMPT_VERSION_DEFAULT = 'mcp-semantic-referee-prompt-v0';

/** A frozen inert state — the value `getMoveState` returns for an unknown move. */
const IDLE_STATE: RefereeMoveState = Object.freeze({
  status: 'idle',
  banner: Object.freeze({ banner: null, selectionTrace: 'idle' }),
  overridePrompt: Object.freeze({
    shouldOffer: false,
    triggerReason: null,
    suggestedLane: 'mainline',
    offersAnswersParentToggle: false,
    contestedClassifierId: null,
    promptCopyCode: '',
  }),
});

/** A frozen inert `fallback` state — renders identically to `IDLE_STATE`. */
const FALLBACK_STATE: RefereeMoveState = Object.freeze({
  ...IDLE_STATE,
  status: 'fallback',
});

/** A frozen inert `pending` state — renders nothing while a call is in flight. */
const PENDING_STATE: RefereeMoveState = Object.freeze({
  ...IDLE_STATE,
  status: 'pending',
});

/**
 * Map a `ParticipantSide`-shaped value onto MCP-015's `SemanticOverrideActorRole`
 * (a different union than MCP-012's `SemanticActorRole`). `moderator` maps to
 * `admin`; an unknown / null side fails closed to `observer` — the role for
 * which MCP-015 always returns `shouldOffer: false`.
 */
export function mapParticipantSideToOverrideActorRole(
  side: string | null | undefined,
): SemanticOverrideActorRole {
  switch (side) {
    case 'affirmative':
      return 'participant_affirmative';
    case 'negative':
      return 'participant_negative';
    case 'moderator':
      return 'admin';
    case 'observer':
    default:
      return 'observer';
  }
}

/**
 * Merge the `binaries` arrays of several packets into one, keeping the first
 * occurrence of each `classifierId`. The merged packet adopts the first
 * packet's scalar fields. Used to fold the ≤ 2 per-batch packets into one.
 */
function mergePacketBinaries(packets: SemanticRefereePacket[]): SemanticRefereePacket {
  const base = packets[0];
  const seen = new Set<string>();
  const merged: SemanticBinarySample[] = [];
  for (const packet of packets) {
    for (const binary of packet.binaries) {
      if (!seen.has(binary.classifierId)) {
        seen.add(binary.classifierId);
        merged.push(binary);
      }
    }
  }
  return { ...base, binaries: merged };
}

/** Deterministic per-move content fingerprint for the client cache key. */
function buildContentHash(moveId: string, redactedBody: string): string {
  return `c:${moveId}:${redactedBody.length}`;
}

// ── The hook ──────────────────────────────────────────────────────

/**
 * Room hook for the semantic-referee mock-mode surface. Call it ONCE at the
 * room-shell level (the same level that owns `useArgumentRoomMessages`).
 */
export function useSemanticReferee(
  options?: UseSemanticRefereeOptions,
): UseSemanticRefereeResult {
  const featureLayerEnabled =
    options?.featureLayerEnabled ?? SEMANTIC_REFEREE_CLIENT_ATTEMPT_DEFAULT;
  const semanticClassificationMode =
    options?.semanticClassificationMode ?? SEMANTIC_CLASSIFICATION_MODE_DEFAULT;

  // The room-scoped LRU cache — created once, lives for the room session.
  const clientCacheRef = useRef<SemanticPacketCache | null>(null);
  if (clientCacheRef.current === null) {
    clientCacheRef.current = new SemanticPacketCache();
  }

  // Mounted guard — a `classifyMove` that resolves after the room unmounts
  // must not `setState`. Flipped false in the unmount cleanup.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [refereeStateByMoveId, setRefereeStateByMoveId] = useState<
    Record<string, RefereeMoveState>
  >({});
  const [overrideRecordsByMoveId, setOverrideRecordsByMoveId] = useState<
    Record<string, SemanticOverrideRecord[]>
  >({});
  const [repeatedSignal, setRepeatedSignal] = useState<RepeatedOverrideSignal>(() =>
    emptyRepeatedOverrideSignal(''),
  );

  // `repeatedSignal` is read inside the async `onMovePosted`; a ref keeps the
  // override prompt's copy code current without re-creating the callback.
  const repeatedSignalRef = useRef(repeatedSignal);
  useEffect(() => {
    repeatedSignalRef.current = repeatedSignal;
  }, [repeatedSignal]);

  // In-flight move ids — guards against a duplicate concurrent call for the
  // same move (two refreshes landing the same just-posted move id).
  const inFlightRef = useRef<Set<string>>(new Set());

  const getMoveState = useCallback(
    (moveId: string): RefereeMoveState => refereeStateByMoveId[moveId] ?? IDLE_STATE,
    [refereeStateByMoveId],
  );

  const getOverrideRecords = useCallback(
    (moveId: string): readonly SemanticOverrideRecord[] =>
      overrideRecordsByMoveId[moveId] ?? [],
    [overrideRecordsByMoveId],
  );

  /**
   * Derive the doctrine-safe projections from a packet and store the `ready`
   * state. Guarded by the mounted ref — a packet for an unmounted room is
   * dropped. MCP-019 passes `ledgerResult` as undefined (Defect 1).
   */
  const finalizeReady = useCallback(
    (
      moveId: string,
      packet: SemanticRefereePacket,
      participantSide: string | null | undefined,
    ): void => {
      if (!mountedRef.current) {
        return;
      }
      const bannerInput = buildBannerSelectionInputFromPacket(packet, undefined);
      const banner = selectBanner(bannerInput);
      const overridePrompt = evaluateSemanticOverridePrompt({
        packet,
        // ledgerResult omitted — MCP-019 does not run the economy ledger.
        viewerActorRole: mapParticipantSideToOverrideActorRole(participantSide),
        repeatedSignal: repeatedSignalRef.current,
      });
      setRefereeStateByMoveId((prev) => ({
        ...prev,
        [moveId]: { status: 'ready', packet, banner, overridePrompt },
      }));
    },
    [],
  );

  const onMovePosted = useCallback(
    async (args: OnMovePostedArgs): Promise<void> => {
      const { roomId, moveId } = args;
      if (!roomId || !moveId) {
        return;
      }
      // Already classified, or already in flight → nothing to do.
      if (refereeStateByMoveId[moveId]?.status === 'ready') {
        return;
      }
      if (inFlightRef.current.has(moveId)) {
        return;
      }

      // 1. Redact bodies client-side BEFORE anything leaves the device.
      const moveBodyRedacted = redactBody(args.body);
      const parentBodyRedacted = args.parentBody
        ? redactBody(args.parentBody)
        : undefined;
      if (moveBodyRedacted.length === 0) {
        // A successful post guarantees a non-empty body; defensively bail.
        return;
      }

      const parentId = args.parentId ?? undefined;
      const promptVersion = args.promptVersionHint ?? PROMPT_VERSION_DEFAULT;
      const contentHash = buildContentHash(moveId, moveBodyRedacted);

      // 2. Build the cache key from the FULL planned classifier set, then look
      //    up the client cache. A hit means this exact move + classifier set
      //    was already fetched this session — no trigger, no call.
      const cacheKey = buildSemanticCacheKey({
        roomId,
        parentId,
        contentHash,
        promptVersion,
        classifierIds: POST_SUBMIT_CLASSIFIER_SET as string[],
        roomMode: args.roomContext?.debateMode,
        selectedAction: args.roomContext?.selectedAction,
      });
      const cache = clientCacheRef.current;
      const cached = cache ? cache.get(cacheKey) : undefined;
      if (cached) {
        // Cache hit — derive the projections from the cached packet, no call.
        finalizeReady(moveId, cached, args.participantSide);
        return;
      }

      // 3. Trigger gate. A `false` decision means no call — layer-1 stands.
      const triggerInput = buildPostSubmitTriggerInput({
        roomId,
        moveId,
        parentId,
        featureLayerEnabled,
        semanticClassificationMode,
        actorRole: mapParticipantSideToActorRole(args.participantSide),
      });
      const decision = evaluateTrigger(triggerInput);
      if (!decision.allowed) {
        // Refused — keep the deterministic layer-1 surface, no error.
        return;
      }

      // 4. Plan batches — ≤ 2 batches, ≤ 5 ids each.
      const batches = planClassifierBatches(POST_SUBMIT_CLASSIFIER_SET);
      if (batches.length === 0) {
        return;
      }

      // Mark in flight + show a `pending` state.
      inFlightRef.current.add(moveId);
      if (mountedRef.current) {
        setRefereeStateByMoveId((prev) => ({ ...prev, [moveId]: PENDING_STATE }));
      }

      try {
        const packets: SemanticRefereePacket[] = [];
        for (const batch of batches) {
          // 5. Token budget per batch. Over budget → skip THIS batch's call.
          const budget = isWithinBudget({
            moveBodyRedacted,
            parentBodyRedacted,
            requestedClassifiers: batch as string[],
          });
          if (!budget.ok) {
            continue;
          }

          // 6. THE ONLY outbound call. One per batch; ≤ 5 ids per call (the
          //    `ClassifyMoveRequest.requestedClassifiers` 1..5 cap).
          let result: ClassifyMoveFunctionResult;
          try {
            result = await classifyMove({
              roomId,
              moveId,
              parentId,
              moveBodyRedacted,
              parentBodyRedacted,
              roomContext: args.roomContext ?? {},
              requestedClassifiers: batch as string[],
              promptVersionHint: promptVersion,
              contentHash,
            });
          } catch {
            // The wrapper "never throws", but belt-and-suspenders: a rejection
            // is treated identically to a disabled / errored result.
            continue;
          }

          if (!result.ok) {
            // Network / wrapper error — treat as disabled, no error shown.
            continue;
          }
          if (result.data.enabled === false) {
            // `{ enabled: false }` for ANY of the 9 reasons — normal, expected.
            continue;
          }
          packets.push(result.data.packet);
        }

        if (packets.length === 0) {
          // Every batch failed / was disabled / over budget → inert fallback.
          if (mountedRef.current) {
            setRefereeStateByMoveId((prev) => ({
              ...prev,
              [moveId]: FALLBACK_STATE,
            }));
          }
          return;
        }

        // 7. Merge the per-batch packets and cache the SUCCESS only.
        const merged = mergePacketBinaries(packets);
        if (cache) {
          cache.set(cacheKey, merged);
        }
        finalizeReady(moveId, merged, args.participantSide);
      } finally {
        inFlightRef.current.delete(moveId);
      }
    },
    [
      refereeStateByMoveId,
      featureLayerEnabled,
      semanticClassificationMode,
      finalizeReady,
    ],
  );

  const confirmOverride = useCallback(
    (moveId: string, choice: ConfirmOverrideArgs): void => {
      const state = refereeStateByMoveId[moveId];
      const prompt = state?.overridePrompt;
      const packet = state?.packet;
      if (!prompt || !prompt.shouldOffer || !packet) {
        // No live prompt to override — nothing to record.
        return;
      }
      const at = choice.at ?? new Date().toISOString();
      const record = buildSemanticOverrideRecord({
        prompt,
        messageId: moveId,
        // MCP-019 keeps the move id as the cluster id — the room does not yet
        // expose a cluster id to this hook; the override record is in-memory.
        clusterId: moveId,
        chosenLane: choice.chosenLane,
        assertsAnswersParent: choice.assertsAnswersParent,
        originalRouteSuggestion: packet.routeSuggestion,
        overriddenByUserId: choice.overriddenByUserId,
        overriddenByActorRole: mapParticipantSideToOverrideActorRole(
          choice.participantSide,
        ),
        at,
      });
      setOverrideRecordsByMoveId((prev) => ({
        ...prev,
        [moveId]: [...(prev[moveId] ?? []), record],
      }));
      // Bump the in-memory, UX-only repeated-override signal.
      setRepeatedSignal((prev) => bumpRepeatedOverrideSignal(prev));
    },
    [refereeStateByMoveId],
  );

  return {
    onMovePosted,
    getMoveState,
    confirmOverride,
    getOverrideRecords,
    repeatedSignal,
  };
}
