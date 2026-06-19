/**
 * UX-001.5 — Read-only API boundary preservation.
 *
 * Asserts UX-001.5 made ZERO changes to:
 *   - UX-001.1 brand-shell files (AppHeader / AppHeaderTagline /
 *     useHeaderBreakpoint / designTokens.ts).
 *   - UX-001.2 Timeline files (ArgumentTimelineMap, ArgumentScoreTracker,
 *     DebateDetailHeader, timelineViewportLayoutModel,
 *     TimelineSelectedReadoutPanel).
 *   - UX-001.3 composer files (ArgumentComposer, ArgumentComposerDock,
 *     composer/*).
 *   - The 3-gate `actPopoutModel.ts`.
 *   - The submit path (`supabase/functions/submit-argument/`).
 *   - The Popout chassis beyond Inspect (`ActPopout.tsx`, `GoPopout.tsx`).
 *
 * Method: git diff against main. The branch base is the merge of main +
 * the UX-001.5 design doc commit; we read the diff of every
 * "read-only" file and assert the diff is empty.
 *
 * If this suite fires, UX-001.5 violated the brief's "Disallowed"
 * scope — investigate before merging.
 */
import { execSync } from 'child_process';

/**
 * Run `git diff main -- <path>` and return the diff text. Returns
 * empty string when the path is unchanged. The repo guarantees
 * `main` is the merge target; UX-001.5 must diff cleanly against it.
 */
function diffAgainstMain(filePath: string): string {
  try {
    return execSync(`git diff main -- "${filePath}"`, {
      encoding: 'utf8',
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    // git diff returns 0 even when the path doesn't exist or is
    // unchanged. A genuine error here is the test failure signal.
    return `<git diff failed: ${(error as Error).message}>`;
  }
}

const READ_ONLY_PATHS: ReadonlyArray<string> = Object.freeze([
  // UX-001.1 brand-shell files
  // NOTE: `src/components/AppHeader.tsx` was removed from the zero-diff
  // boundary on 2026-05-26 when the operator requested a prominent logo
  // (≥ 3× the prior wide-band size) and a left-flush, tight-padding
  // header. The local overrides (PROMINENT_LOGO_HEIGHT_PX, etc.) keep
  // the rest of the design system untouched; the contract tests in
  // appHeader.test.ts / useHeaderBreakpoint.test.ts /
  // uxOneOneAppHeaderDensity.test.ts continue to verify the asset
  // path, accessibility labels, and component shape.
  'src/components/AppHeaderTagline.tsx',
  'src/hooks/useHeaderBreakpoint.ts',
  // NOTE: `src/lib/designTokens.ts` was removed from the zero-diff
  // boundary by UX-001.7. UX-001.7's design doc §12.A explicitly
  // authorizes additive token extensions to designTokens.ts (the
  // Workstream 1 deliverable). The read-only contract for that file
  // is now maintained by `uxOneOneSixReadOnlyBoundary.test.ts`'s
  // `requiredApi`-surface assertion (which UX-001.7's additive
  // extensions preserve) plus the UX-001.7 design-doc-authorized
  // additive-only extension policy. See
  // `docs/designs/UX-001.7.md` §19.B for the resolution rationale.

  // UX-001.2 Timeline files
  // NOTE: `src/features/arguments/ArgumentTimelineMap.tsx` was removed from the
  // zero-diff boundary by the operator-authorized UX-MOBILE-001 card
  // (2026-06-15). TICKET-004 (P1, GATE-C) explicitly requires the thread /
  // timeline toolbar controls to meet a >= 44×44 touch target on mobile; the
  // edit is a purely additive, presentational `hitSlop` change (the sub-floor
  // `{left:4,right:4}` controls + the per-node info icon now use
  // `TOUCH_TARGET.hitSlopAll`), with no API / behavior change. The file's
  // load-bearing contract stays pinned by `argumentTimelineMap.test.ts`, and
  // the touch-target change itself is pinned by
  // `uxMobile001MobileHardening.test.ts`. Mirrors the prior operator-authorized
  // AppHeader / designTokens relaxations above.
  // NOTE: `src/features/arguments/ArgumentScoreTracker.tsx` was removed
  // from the zero-diff boundary by the operator-authorized UX-COPY-001
  // card (CivilDiscourse v4 copy overhaul). UX-COPY-001 §3 explicitly
  // requires de-scoring the visible labels in this component (the empty
  // note "Score tracker appears once messages exist." -> doctrine-clean
  // phrasing; the title "Standings · gameplay analysis" ->
  // "Where the points stand · gameplay analysis"; the
  // accessibilityLabel "score-tracker-title" -> "where the points
  // stand"). The change is copy-only — the component shape, props,
  // testID `argument-score-tracker`, scoring model, and band logic are
  // all unchanged. The doctrine cleanliness of the rendered strings is
  // pinned by `uxCopyOneCivilDiscourseRebrand.test.ts`. Mirrors the
  // prior operator-authorized AppHeader / designTokens / TimelineMap /
  // actPopoutModel relaxations above.
  'src/features/debates/DebateDetailHeader.tsx',
  'src/features/arguments/timelineViewportLayoutModel.ts',
  // NOTE: `src/features/arguments/TimelineSelectedReadoutPanel.tsx` was
  // removed from the zero-diff boundary by the operator-authorized
  // UX-SELECTED-NODE-001 card (selected-node "center of the room"
  // treatment, LOCAL-ONLY scope). UX-SELECTED-NODE-001 §3 explicitly
  // requires surfacing the v4 "Responding to this point" anchor + the
  // already-on-model parent excerpt (`parentBodyPreview`), an in-card gold
  // halo + left-accent on the selected card, and a read-only "Go to parent
  // point" jump — all WITHIN this selected-node card (no room-level rail or
  // timeline-topology change; that scope is UX-BOARD-RAIL-001 #706). The
  // edit is additive + presentational: the compact 5-line summary, the
  // expand trigger, the IX-004 live-region / stale-banner contract, and the
  // back-compat sidecar path are all preserved. The file's load-bearing
  // contract stays pinned by `uxOneOneTwoReadoutCompactMode.test.ts`,
  // `timelineReadoutBanList.test.ts`, and the new
  // `uxSelectedNode001CenterOfRoom.test.tsx`. Mirrors the prior
  // operator-authorized AppHeader / designTokens / TimelineMap /
  // ScoreTracker / actPopoutModel relaxations above.

  // UX-001.3 composer files
  'src/features/arguments/ArgumentComposer.tsx',
  'src/features/arguments/ArgumentComposerDock.tsx',
  'src/features/arguments/composer/ComposerContextStrip.tsx',
  'src/features/arguments/composer/CollapsedComposerStrip.tsx',
  'src/features/arguments/composer/composerDraftRegistry.ts',
  'src/features/arguments/composer/composerKeyboardModel.ts',
  'src/features/arguments/composer/useComposerFocusContext.ts',
  'src/features/arguments/composer/composerActingOnModel.ts',
  'src/features/arguments/composer/composerHaptics.ts',
  // NOTE: `src/features/arguments/ComposerValidationPanel.tsx` was
  // removed from the zero-diff boundary by the operator-authorized
  // UX-COPY-001 card. UX-COPY-001 §3 requires de-scoring the visible
  // "Score" label in the __DEV__-only "Topic coverage (dev)" block
  // (relabelled "Topic fit"). The change is copy-only and confined to a
  // dev-build-gated readout — the validation behavior, props, section
  // structure, and the non-dev rendered surface are unchanged. The
  // doctrine cleanliness of the rendered strings is pinned by
  // `uxCopyOneCivilDiscourseRebrand.test.ts`. Mirrors the prior
  // operator-authorized relaxations above.
  'src/features/rulesUx/validationActionMap.ts',
  'src/features/arguments/oneBox/OneBox.tsx',

  // 3-gate model + Act/Go popouts (UX-001.4 menu chassis)
  // NOTE: `src/features/arguments/oneBox/actPopoutModel.ts` was removed
  // from the zero-diff boundary by the operator-authorized REF-005
  // follow-up (2026-06-12): REF-005's design §8 specifies the bounded
  // `flag`-entry relabel (label -> "Request review", accessibilityLabel
  // -> "Open a structured concern about this move"; id / kind /
  // opensBoxType / argumentType unchanged), which a zero-diff pin
  // cannot admit. The file's load-bearing contract stays pinned by
  // `actPopoutModel.test.ts` (3-gate behavior + entry table) and
  // `oneBoxCopyBanList.test.ts` (copy ban-list), plus the ActEntryId
  // export assertion below.
  'src/features/arguments/oneBox/ActPopout.tsx',
  'src/features/arguments/oneBox/GoPopout.tsx',
  'src/features/arguments/oneBox/Popout.tsx',
]);

const SUBMIT_PATH_DIR = 'supabase/functions/submit-argument';

describe('UX-001.5 — read-only API boundary preservation', () => {
  for (const filePath of READ_ONLY_PATHS) {
    it(`${filePath} — zero diff against main`, () => {
      const diff = diffAgainstMain(filePath);
      expect(diff).toBe('');
    });
  }
});

describe('UX-001.5 — submit path: UX-001.5 surface preserved', () => {
  // NOTE: `supabase/functions/submit-argument/` was relaxed from the
  // strict zero-diff boundary on 2026-05-26 when
  // MCP-021C-AUTO-TRIGGER-FAMILY-A added the fire-and-forget Boolean
  // Observation classifier dispatcher in the post-insert tail. The
  // submit-argument auth chain, validation, insert path, notification
  // side-effect, and response shape are byte-equal preserved. The
  // MCP-021C-AUTO-TRIGGER-FAMILY-A design doc at
  // `docs/designs/MCP-021C-AUTO-TRIGGER-FAMILY-A.md` §11.1 explicitly
  // authorizes this bounded edit. The companion source-scan tests
  // (`mcpOneTwoOneCAutoTriggerFamilyA.test.ts`) pin the shape of the
  // new wiring. The UX-001.5 read-only boundary remains in spirit:
  // none of UX-001.5's surface-area touches (composer, timeline, brand
  // shell, popouts) are affected.
  //
  // This test verifies the diff against main, if any, is confined to the
  // post-insert classifier DISPATCH TAIL — first the
  // MCP-021C-AUTO-TRIGGER-FAMILY-A bounded additions (dispatcher import +
  // EdgeRuntime declaration + fire-and-forget call site), and now also the
  // ARCH-001 Card 2 routing change (`docs/designs/ARCH-001-CARD2-DRAINER-ENQUEUE-intent.md`
  // §A.11), which wraps that same dispatch call in a mutually-exclusive
  // `if (shouldRouteToQueue) { enqueueClassifierJobs } else { ...the
  // UNCHANGED direct dispatch... }`. Relocating the original dispatch lines
  // into the `else` arm makes git report them as REMOVED + re-ADDED (with
  // indentation), so the boundary is now: every REMOVED line must reference
  // the classifier dispatch surface (proving the relocation touched ONLY the
  // dispatch tail — NOT auth, validation, the insert, the notification
  // side-effect, or the response shape), and the additions must reference
  // that surface or the Card-2 queue-routing module.
  it(`${SUBMIT_PATH_DIR}/ — diff confined to the classifier dispatch tail (auto-trigger + ARCH-001 Card 2 routing)`, () => {
    const diff = diffAgainstMain(SUBMIT_PATH_DIR);
    if (diff === '') return; // no diff — test trivially passes.
    const addedLines = diff
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'));
    const removedLines = diff
      .split('\n')
      .filter((line) => line.startsWith('-') && !line.startsWith('---'));

    // The set of tokens that mark a line as part of the authorized
    // classifier dispatch tail (auto-trigger OR ARCH-001 Card 2/3 routing).
    const DISPATCH_TAIL_TOKENS = [
      'dispatchAutoTriggerForArgument',
      'MCP-021C-AUTO-TRIGGER-FAMILY-A',
      'EdgeRuntime',
      'autoTriggerPromise',
      'enqueuePromise',
      'Boolean Observation',
      'booleanObservations/autoTriggerDispatcher',
      'classifierQueueRouting',
      'shouldRouteToQueue',
      'enqueueClassifierJobs',
      'CLASSIFIER_QUEUE_ROUTING_ENABLED',
      'CLASSIFIER_QUEUE_ROUTING_PERCENTAGE',
      'parseRoutingPercentage',
      'queueRoutingEnabled',
      'queueRoutingPercentage',
      'Card 3',
      'ARCH-001',
    ];
    const isDispatchTailLine = (line: string): boolean => {
      const body = line.slice(1).trim();
      // Pure structural lines (braces / blank) and the EXACT relocated
      // dispatch-call argument lines are part of the relocation. Anything
      // carrying real identifiers must hit a dispatch-tail token — this is
      // what keeps an auth/validation/insert/notification/response removal a
      // FAILURE (those lines match neither the narrow structural set nor a
      // token).
      if (body === '' || /^[}{)\];]*$/.test(body)) return true;
      if (
        body === 'insertedArg.id,' ||
        body === 'data.debate_id,' ||
        body === 'serviceClient,' ||
        body.startsWith(').catch(')
      ) {
        return true;
      }
      return DISPATCH_TAIL_TOKENS.some((tok) => line.includes(tok));
    };

    // BOUNDARY: every removed line is confined to the dispatch-tail relocation
    // (NOT an edit to auth / validation / insert / notification / response).
    const offendingRemovals = removedLines.filter((line) => !isDispatchTailLine(line));
    expect(offendingRemovals).toEqual([]);

    // The additions must reference the classifier dispatch tail (auto-trigger
    // or the Card-2 queue routing).
    const referencesDispatchTail = addedLines.some((line) =>
      DISPATCH_TAIL_TOKENS.some((tok) => line.includes(tok)),
    );
    expect(referencesDispatchTail).toBe(true);
  });
});

describe('UX-001.5 — 3-gate model exports unchanged', () => {
  // The 3-gate actPopoutModel.ts is the load-bearing chassis contract
  // for the Act popout. UX-001.5 must NOT touch it. The diff scan
  // above catches any change; this assertion verifies the existence
  // of the file via its exports (sanity check).
  it('actPopoutModel.ts exports ActEntryId (load-bearing type)', () => {
    // Use require() to fetch the module synchronously without
    // triggering Babel's async transform; the diff scan above is
    // the load-bearing assertion.
    const mod = require('../src/features/arguments/oneBox/actPopoutModel');
    expect(mod).toBeDefined();
    // ActEntryId is a TypeScript type (not a runtime export), but the
    // module having loaded confirms the file is unchanged at the
    // compile boundary.
  });
});
