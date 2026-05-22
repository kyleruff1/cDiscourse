/**
 * QOL-032 — Inspect popout content model (node & evidence detail, pure TS).
 *
 * `buildInspectPopout(input)` is the pure function that produces the Inspect
 * popout's fixed section set (QOL-032 design §3.2) with the LIFE-001
 * stage-driven emphasis applied (§3.3). The Inspect popout is the
 * *understand* surface — the read-only node / evidence / branch detail
 * panel. It is the second sibling that stands on the QOL-030 chassis,
 * beside Act (QOL-031) and Go (QOL-033).
 *
 * The Inspect popout has SEVEN sections (design §3.2) — the SET IS FIXED:
 * every section is ALWAYS present. Emphasis only RE-ORDERS which section is
 * pulled to the top and expanded; it NEVER removes a section.
 *
 *   1. What this move says   — the argument body, plain.
 *   2. Why it matters        — its relation to the parent (META-001).
 *   3. What is unresolved    — open axes / evidence debt (LIFE-001 + EV-003).
 *   4. Where it sits         — mainline / branch / tangent (BR-001/004).
 *   5. Suggested next move   — a hand-off chip → opens the Act popout.
 *   6. Semantic flags        — RULE-001/003 plain-language; never raw codes.
 *   E. Evidence detail       — the EV-001 object (date / amount / note /
 *                              status). "No evidence attached" when absent.
 *
 * Doctrine anchors — read this before changing anything (design §9,
 * cdiscourse-doctrine §1/§2/§9, timeline-grammar, evidence-doctrine):
 *
 *   - STRICTLY READ-ONLY. Inspect never writes, never posts, never edits a
 *     body, never opens the box. The §5 "Suggested next move" is the SINGLE
 *     bridge — it HANDS OFF to the Act popout (it carries an `ActEntryId`);
 *     Inspect itself opens nothing. This module never imports `supabase`,
 *     `fetch`, a router, React, or any network primitive.
 *   - Plain language only — every rendered string is plain English. No raw
 *     `snake_case` / internal code reaches a section title or body
 *     (RULE-001 ban-list, enforced by `oneBoxCopyBanList.test.ts`).
 *   - No verdict / winner / loser / truth / true / false copy. "What is
 *     unresolved" describes the MOVE, never the person.
 *   - Heat, if shown, is labelled ACTIVITY — never correctness.
 *   - Deterministic pure projection over already-built models — META-001,
 *     LIFE-001, RULE-001/003, EV-001, EV-003, BR-001/004 — all consumed
 *     READ-ONLY. This module re-derives none of them. No AI. No `Date.now()`.
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */

import type { PointLifecycleState } from '../../lifecycle';
import type { ActEntryId } from './actPopoutModel';

// ── Section vocabulary ─────────────────────────────────────────

/**
 * A stable identifier for every Inspect section (QOL-032 design §3.2).
 * `evidence_detail` is the §E "Evidence detail" section; the six numbered
 * sections take the `says` / `matters` / `unresolved` / `sits` /
 * `next_move` / `flags` ids.
 */
export type InspectSectionId =
  | 'says' // §1 What this move says
  | 'matters' // §2 Why it matters
  | 'unresolved' // §3 What is unresolved
  | 'sits' // §4 Where it sits
  | 'next_move' // §5 Suggested next move
  | 'flags' // §6 Semantic flags
  | 'evidence_detail'; // §E Evidence detail

/**
 * The Inspect section set in NUMBERED order — §1 → §6 then §E. This is the
 * fixed, always-present set (design §3.2). `buildInspectPopout` returns
 * every one of these on every call; emphasis only re-orders the array.
 */
export const INSPECT_SECTION_ORDER: ReadonlyArray<InspectSectionId> = Object.freeze([
  'says',
  'matters',
  'unresolved',
  'sits',
  'next_move',
  'flags',
  'evidence_detail',
]);

/**
 * Plain-language section titles (design §3.2). No verdict vocabulary, no
 * internal code — scanned by `oneBoxCopyBanList.test.ts`. "What is
 * unresolved" is authored to describe the MOVE, never the person.
 */
export const INSPECT_SECTION_TITLE: Readonly<Record<InspectSectionId, string>> = Object.freeze({
  says: 'What this move says',
  matters: 'Why it matters',
  unresolved: 'What is unresolved',
  sits: 'Where it sits',
  next_move: 'Suggested next move',
  flags: 'Semantic flags',
  evidence_detail: 'Evidence detail',
});

/**
 * Verbose accessibility labels for each section header — a screen-reader
 * user gets one read per element. Plain English, ≤ 80 chars, no verdict
 * token (scanned by `oneBoxCopyBanList.test.ts`).
 */
export const INSPECT_SECTION_ACCESSIBILITY_LABEL: Readonly<Record<InspectSectionId, string>> =
  Object.freeze({
    says: 'What this move says — the body of the argument',
    matters: 'Why it matters — how this move relates to its parent',
    unresolved: 'What is unresolved — the open axes and evidence owed on this move',
    sits: 'Where it sits — the position of this move in the conversation',
    next_move: 'Suggested next move — opens the Act menu at the suggested entry',
    flags: 'Semantic flags — the advisory notes on this move, in plain language',
    evidence_detail: 'Evidence detail — the source, date, amount, and status of attached evidence',
  });

// ── §5 narrative-frame table — stage → suggested-move copy ──────

/**
 * The §5 "Suggested next move" narrative frame for a node stage (QOL-032
 * design §5). Each stage names ONE Act entry the hand-off chip opens, plus
 * the plain-language frame copy shown on the chip.
 *
 * Doctrine: the suggested move is a SUGGESTION, never a verdict. The copy
 * describes a move the viewer MAY make; it never says the move is right,
 * the point is won, or the person is wrong (design §9).
 */
interface InspectSuggestedMove {
  /** The Act entry the §5 hand-off chip opens. */
  actEntryId: ActEntryId;
  /** Plain-language chip label. ≤ 24 chars. */
  chipLabel: string;
  /** One-line plain-language frame copy. ≤ 96 chars. */
  frame: string;
}

/**
 * The §5 stage → suggested-move table. Every LIFE-001 stage maps to one
 * suggested move; the §5 narrative-frame tests reproduce this table.
 *
 * The Act entry ids are real `ActEntryId`s from `actPopoutModel` — the
 * hand-off opens the Act popout AT that entry (design §4). The frame copy
 * is authored to the design §5 narrative frames: "review the response",
 * "consider a side branch", "attach a source", "synthesize".
 */
const INSPECT_SUGGESTED_MOVE: Readonly<Record<PointLifecycleState, InspectSuggestedMove>> =
  Object.freeze({
    open: Object.freeze({
      actEntryId: 'reply',
      chipLabel: 'Reply to this move',
      frame: 'This move is open. A reply keeps the conversation moving.',
    }),
    answered: Object.freeze({
      actEntryId: 'reply',
      chipLabel: 'Reply to this move',
      frame: 'This move has an answer. A reply carries the exchange forward.',
    }),
    rebutted: Object.freeze({
      actEntryId: 'reply',
      chipLabel: 'Reply to this move',
      frame: 'A challenge is on the table. A reply addresses the open point.',
    }),
    clarified: Object.freeze({
      actEntryId: 'reply',
      chipLabel: 'Reply to this move',
      frame: 'A clarification was given. A reply picks the exchange back up.',
    }),
    source_requested: Object.freeze({
      actEntryId: 'add_evidence',
      chipLabel: 'Attach a source',
      frame: 'A source was asked for here. Attaching one answers the request.',
    }),
    quote_requested: Object.freeze({
      actEntryId: 'add_evidence',
      chipLabel: 'Attach a quote',
      frame: 'A quote was asked for here. Attaching one answers the request.',
    }),
    sourced: Object.freeze({
      actEntryId: 'respond_to_evidence',
      chipLabel: 'Respond to the evidence',
      frame: 'Evidence is attached. You can respond to what it shows.',
    }),
    narrowed: Object.freeze({
      actEntryId: 'confirm',
      chipLabel: 'Confirm the narrowed point',
      frame: 'The point was narrowed. Confirming settles what now stands.',
    }),
    conceded: Object.freeze({
      actEntryId: 'synthesize',
      chipLabel: 'Synthesize the outcome',
      frame: 'A point was conceded. A synthesis records where it landed.',
    }),
    confirmed: Object.freeze({
      actEntryId: 'synthesize',
      chipLabel: 'Synthesize the outcome',
      frame: 'The point was confirmed. A synthesis records where it landed.',
    }),
    synthesis_ready: Object.freeze({
      actEntryId: 'synthesize',
      chipLabel: 'Synthesize the outcome',
      frame: 'This cluster is ready to synthesize into one summary move.',
    }),
    moved_on_by_affirmative: Object.freeze({
      actEntryId: 'branch_tangent',
      chipLabel: 'Open a side issue',
      frame: 'Activity has moved on. A side issue keeps a stray point alive.',
    }),
    moved_on_by_negative: Object.freeze({
      actEntryId: 'branch_tangent',
      chipLabel: 'Open a side issue',
      frame: 'Activity has moved on. A side issue keeps a stray point alive.',
    }),
    ignored_by_affirmative: Object.freeze({
      actEntryId: 'branch_tangent',
      chipLabel: 'Open a side issue',
      frame: 'This point has gone quiet. A side issue gives it its own space.',
    }),
    ignored_by_negative: Object.freeze({
      actEntryId: 'branch_tangent',
      chipLabel: 'Open a side issue',
      frame: 'This point has gone quiet. A side issue gives it its own space.',
    }),
    ignored_by_both: Object.freeze({
      actEntryId: 'branch_tangent',
      chipLabel: 'Open a side issue',
      frame: 'This point has gone quiet. A side issue gives it its own space.',
    }),
    exhausted: Object.freeze({
      actEntryId: 'branch_tangent',
      chipLabel: 'Open a side issue',
      frame: 'This axis has run its course. A side issue opens a fresh angle.',
    }),
    branch_recommended: Object.freeze({
      actEntryId: 'branch_tangent',
      chipLabel: 'Open a side issue',
      frame: 'This move introduces a new axis. A side issue keeps it tidy.',
    }),
    archived_or_resolved: Object.freeze({
      actEntryId: 'view_qualifiers',
      chipLabel: 'View the qualifiers',
      frame: 'This argument is settled. You can still review its qualifiers.',
    }),
  });

/**
 * Returns the §5 suggested move for a node stage. For a `null` stage (a
 * non-node target, or LIFE-001 unavailable — design §7) the fallback is a
 * plain `reply` suggestion: the safest, lowest-commitment move.
 */
export function getInspectSuggestedMove(stage: PointLifecycleState | null): InspectSuggestedMove {
  if (stage === null) {
    return {
      actEntryId: 'reply',
      chipLabel: 'Reply to this move',
      frame: 'A reply keeps the conversation moving.',
    };
  }
  return INSPECT_SUGGESTED_MOVE[stage];
}

// ── §3.3 stage-driven emphasis ─────────────────────────────────

/**
 * The §3.3 emphasis table — for a node's LIFE-001 stage, which Inspect
 * section is pulled to the TOP and expanded by default.
 *
 * Doctrine (design §3.3): emphasis ONLY re-orders. Every section stays in
 * the set; the emphasised section is moved to slot 0 and marked expanded.
 * No section is ever removed. A `null` stage (design §7) emphasises §1.
 *
 * The table is the design §3.3 mapping verbatim:
 *   open · answered                    → §1 What this move says
 *   rebutted · clarified               → §3 What is unresolved
 *   source_requested · quote_requested → §3 What is unresolved (evidence debt)
 *   sourced                            → §E Evidence detail
 *   narrowed · conceded                → §2 Why it matters
 *   confirmed · synthesis_ready        → §5 Suggested next move
 *   moved_on · ignored · exhausted     → §4 Where it sits
 *   branch_recommended                 → §4 Where it sits (offer to branch)
 *   archived_or_resolved               → §1 What this move says (+ settled banner)
 */
const STAGE_EMPHASIZED_SECTION: Readonly<Record<PointLifecycleState, InspectSectionId>> =
  Object.freeze({
    open: 'says',
    answered: 'says',
    rebutted: 'unresolved',
    clarified: 'unresolved',
    source_requested: 'unresolved',
    quote_requested: 'unresolved',
    sourced: 'evidence_detail',
    narrowed: 'matters',
    conceded: 'matters',
    confirmed: 'next_move',
    synthesis_ready: 'next_move',
    moved_on_by_affirmative: 'sits',
    moved_on_by_negative: 'sits',
    ignored_by_affirmative: 'sits',
    ignored_by_negative: 'sits',
    ignored_by_both: 'sits',
    exhausted: 'sits',
    branch_recommended: 'sits',
    archived_or_resolved: 'says',
  });

/**
 * The Inspect section emphasised for a node stage. For a `null` stage (a
 * non-node target, or LIFE-001 unavailable — design §7) the fallback is
 * §1 "What this move says" — the always-safe default.
 */
export function getEmphasizedSection(stage: PointLifecycleState | null): InspectSectionId {
  if (stage === null) return 'says';
  return STAGE_EMPHASIZED_SECTION[stage];
}

// ── Public types — the popout output ───────────────────────────

/**
 * One rendered Inspect section (the component consumes this). Every
 * section in the set produces exactly one of these on every call — the
 * set is fixed (design §3.2).
 */
export interface InspectSection {
  /** Stable section id. */
  id: InspectSectionId;
  /** Plain-language section title. */
  title: string;
  /** Verbose accessibility label for the section header. */
  accessibilityLabel: string;
  /**
   * Plain-language body for the section. Always a non-empty string — an
   * empty / absent input renders an explicit "nothing here" line (design
   * §7), never a blank section.
   */
  body: string;
  /**
   * True for the SINGLE §3.3 stage-emphasised section. The component pulls
   * it to the top and expands it by default; every other section renders
   * collapsed. Emphasis is re-order only — never removal (design §3.3).
   */
  isEmphasized: boolean;
  /**
   * True when the section is expanded by default. Equal to `isEmphasized`
   * — the emphasised section opens expanded; the rest open collapsed. The
   * component still lets the user expand any collapsed section (read-only
   * detail, never hidden).
   */
  isExpandedByDefault: boolean;
}

/**
 * The §5 Suggested-next-move hand-off descriptor — the SINGLE bridge from
 * Inspect (understand) to Act (do). The component renders this as a chip
 * inside the §5 section; pressing it closes Inspect and opens the Act
 * popout at `actEntryId` (design §4). When `isDisabled` is true (an
 * archived room — design §7) the chip renders disabled with `disabledReason`.
 */
export interface InspectHandoff {
  /** The Act entry the hand-off chip opens. */
  actEntryId: ActEntryId;
  /** Plain-language chip label. */
  chipLabel: string;
  /** One-line plain-language frame copy shown above the chip. */
  frame: string;
  /** True when the hand-off chip is rendered but cannot be invoked. */
  isDisabled: boolean;
  /** One-line plain-language reason — present only when `isDisabled`. */
  disabledReason: string | null;
}

/**
 * The full Inspect popout view-model — the fixed section set plus the §5
 * hand-off descriptor and the settled-room banner flag.
 */
export interface InspectPopoutModel {
  /**
   * The seven sections, ordered with the §3.3 emphasised section first
   * and the remaining six in `INSPECT_SECTION_ORDER`. The set is ALWAYS
   * complete — `sections.length` is always 7.
   */
  sections: ReadonlyArray<InspectSection>;
  /** The §5 hand-off descriptor — the single Inspect → Act bridge. */
  handoff: InspectHandoff;
  /**
   * True for an `archived_or_resolved` node — the component renders a
   * one-line "settled" banner above §1 (design §3.3 row `archived_or_resolved`
   * "§1 + a settled banner"). The banner states the argument is settled;
   * it never declares a winner (design §9).
   */
  showsSettledBanner: boolean;
}

// ── Section-body inputs ────────────────────────────────────────

/**
 * The plain-language content for each Inspect section, supplied by the
 * host READ-ONLY. Inspect RENDERS these — it derives none of them (design
 * §2 / §10). Each field is OPTIONAL: an absent / empty field renders the
 * section's explicit "nothing here" fallback (design §7), never a blank
 * section.
 *
 *  - `says`            — the argument body, plain (design §3.2 row 1).
 *  - `matters`         — relation to the parent, from META-001 (row 2).
 *  - `unresolved`      — open axes / evidence debt, from LIFE-001 + EV-003
 *                        (row 3). Authored to describe the MOVE, never the
 *                        person (design §9).
 *  - `sits`            — mainline / branch / tangent position, from
 *                        BR-001/004 (row 4).
 *  - `semanticFlags`   — RULE-001/003 plain-language flag lines (row 6).
 *                        An empty array renders "No semantic flags"
 *                        (design §7) — never a raw code.
 *  - `evidenceDetail`  — the EV-001 object rendered to plain language
 *                        (date / amount / note / status, design §3.2 row
 *                        E). Absent renders "No evidence attached" (§7).
 */
export interface InspectSectionContent {
  /** §1 — the argument body, plain. */
  says?: string;
  /** §2 — relation to the parent (META-001). */
  matters?: string;
  /** §3 — open axes / evidence debt (LIFE-001 + EV-003). */
  unresolved?: string;
  /** §4 — mainline / branch / tangent position (BR-001/004). */
  sits?: string;
  /** §6 — RULE-001/003 plain-language semantic-flag lines. */
  semanticFlags?: ReadonlyArray<string>;
  /** §E — the EV-001 evidence object rendered to plain language. */
  evidenceDetail?: string;
}

/** Inputs to `buildInspectPopout` (QOL-032 design §3.2 / §3.3 / §7). */
export interface BuildInspectPopoutInput {
  /**
   * The selected node's LIFE-001 stage — drives the §3.3 emphasis + the §5
   * suggested move. `null` for a non-node target, or when LIFE-001 is
   * unavailable (design §7 degraded fallback — §1 is emphasised, `reply`
   * is suggested).
   */
  stage: PointLifecycleState | null;
  /**
   * The plain-language section content, supplied READ-ONLY by the host.
   * Every field is optional — an absent field renders its §7 fallback.
   */
  content: InspectSectionContent;
  /**
   * True when the room is archived — the §5 hand-off chip renders disabled
   * with the reason "this argument is settled" (design §7). Inspect itself
   * stays fully functional (it is read-only). Defaults to `false`.
   */
  isArchivedRoom?: boolean;
}

// ── §7 fallback copy — every section is stable, never blank ─────

/**
 * The §7 "nothing here" fallback copy. A section whose input is absent /
 * empty renders one of these — the section set stays stable (design §3.2
 * "the section set is stable"). None of these is a raw code or a verdict.
 */
export const INSPECT_EMPTY_BODY = Object.freeze({
  /** §1 — a node with no legible body (defensive). */
  says: 'This move has no readable text.',
  /** §2 — a root claim has no parent to relate to. */
  matters: 'This is the opening claim — it has no parent move.',
  /** §3 — nothing is owed and no axis is open on this move. */
  unresolved: 'Nothing is open on this move right now.',
  /** §4 — position could not be determined (defensive). */
  sits: 'The position of this move could not be determined.',
  /** §6 — the MCP layer is off / produced no flags (design §7). */
  flags: 'No semantic flags.',
  /** §E — the node has no evidence attached (design §7). */
  evidenceDetail: 'No evidence attached.',
});

/**
 * The §7 archived-room hand-off disabled reason. The §5 chip is the ONLY
 * thing disabled in an archived room — Inspect itself fully works (design
 * §7 "Inspect fully works … only the §5 hand-off chip is disabled").
 */
export const INSPECT_ARCHIVED_HANDOFF_REASON = 'This argument is settled.';

/**
 * The settled-room banner copy (design §3.3 row `archived_or_resolved`).
 * States the argument is settled — never declares a winner (design §9).
 */
export const INSPECT_SETTLED_BANNER = 'This argument is settled — Inspect is read-only here.';

// ── Section-body resolution ────────────────────────────────────

/**
 * Resolves the plain-language body for one section. An absent / empty
 * input falls back to the §7 "nothing here" copy — the section is NEVER
 * left blank (design §3.2 / §7). For §6 the semantic-flag lines are joined
 * with a separator; an empty array yields "No semantic flags".
 *
 * Pure. The §5 section's body is the suggested-move frame (the chip itself
 * is carried separately on `InspectHandoff`).
 */
function resolveSectionBody(
  id: InspectSectionId,
  content: InspectSectionContent,
  handoff: InspectHandoff,
): string {
  switch (id) {
    case 'says': {
      const v = content.says?.trim();
      return v && v.length > 0 ? v : INSPECT_EMPTY_BODY.says;
    }
    case 'matters': {
      const v = content.matters?.trim();
      return v && v.length > 0 ? v : INSPECT_EMPTY_BODY.matters;
    }
    case 'unresolved': {
      const v = content.unresolved?.trim();
      return v && v.length > 0 ? v : INSPECT_EMPTY_BODY.unresolved;
    }
    case 'sits': {
      const v = content.sits?.trim();
      return v && v.length > 0 ? v : INSPECT_EMPTY_BODY.sits;
    }
    case 'next_move':
      // §5's body is the suggested-move frame; the chip is on `handoff`.
      return handoff.frame;
    case 'flags': {
      const lines = (content.semanticFlags ?? [])
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      return lines.length > 0 ? lines.join(' · ') : INSPECT_EMPTY_BODY.flags;
    }
    case 'evidence_detail': {
      const v = content.evidenceDetail?.trim();
      return v && v.length > 0 ? v : INSPECT_EMPTY_BODY.evidenceDetail;
    }
    default: {
      // Exhaustiveness guard — unreachable for the typed union.
      const never: never = id;
      return never;
    }
  }
}

// ── buildInspectPopout — the pure builder ──────────────────────

/**
 * Builds the Inspect popout content — the fixed seven-section set with the
 * §3.3 stage-emphasised section pulled to slot 0, plus the §5 hand-off
 * descriptor and the settled-room banner flag.
 *
 * The pipeline (QOL-032 design §3.2 / §3.3 / §5 / §7):
 *   1. Resolve the §5 hand-off — the suggested move for the stage; disabled
 *      with a reason when the room is archived.
 *   2. Resolve every section's plain-language body (the §7 fallback fills
 *      an absent input — a section is never blank).
 *   3. Pick the §3.3 emphasised section for the stage; mark it
 *      `isEmphasized` + `isExpandedByDefault`.
 *   4. Order: the emphasised section first, then the remaining six in
 *      `INSPECT_SECTION_ORDER`. The SET STAYS COMPLETE — `sections.length`
 *      is always 7.
 *
 * Pure. Deterministic. Idempotent. No AI, no network, no `Date.now()`.
 *
 * Doctrine: Inspect produces NO write — it is the *understand* surface.
 * The §5 hand-off only NAMES an `ActEntryId`; the host opens the Act
 * popout. Inspect never opens the box itself (design §4). Emphasis only
 * RE-ORDERS — every section is always in the returned set (design §3.3).
 */
export function buildInspectPopout(input: BuildInspectPopoutInput): InspectPopoutModel {
  const isArchivedRoom = input.isArchivedRoom === true;

  // Step 1 — the §5 hand-off descriptor.
  const suggested = getInspectSuggestedMove(input.stage);
  const handoff: InspectHandoff = {
    actEntryId: suggested.actEntryId,
    chipLabel: suggested.chipLabel,
    frame: suggested.frame,
    isDisabled: isArchivedRoom,
    disabledReason: isArchivedRoom ? INSPECT_ARCHIVED_HANDOFF_REASON : null,
  };

  // Step 3 (computed early so step 2 can mark each section) — the §3.3
  // emphasised section.
  const emphasizedId = getEmphasizedSection(input.stage);

  // Step 2 — build every section. The set is fixed; iterate the numbered
  // order, then re-order in step 4.
  const byId = new Map<InspectSectionId, InspectSection>();
  for (const id of INSPECT_SECTION_ORDER) {
    const isEmphasized = id === emphasizedId;
    byId.set(id, {
      id,
      title: INSPECT_SECTION_TITLE[id],
      accessibilityLabel: INSPECT_SECTION_ACCESSIBILITY_LABEL[id],
      body: resolveSectionBody(id, input.content, handoff),
      isEmphasized,
      isExpandedByDefault: isEmphasized,
    });
  }

  // Step 4 — emphasised section first, the remaining six in numbered order.
  // The set stays COMPLETE — every section appears exactly once.
  const ordered: InspectSection[] = [];
  const emphasized = byId.get(emphasizedId);
  if (emphasized) ordered.push(emphasized);
  for (const id of INSPECT_SECTION_ORDER) {
    if (id === emphasizedId) continue;
    const section = byId.get(id);
    if (section) ordered.push(section);
  }

  return {
    sections: ordered,
    handoff,
    showsSettledBanner: input.stage === 'archived_or_resolved',
  };
}

/**
 * Convenience: looks up one section in a built model by id. Useful for
 * tests + for a component that renders a specific section out of order.
 * Returns `null` when the id is somehow absent (never, for a well-formed
 * model — the set is fixed).
 */
export function getInspectSection(
  model: InspectPopoutModel,
  id: InspectSectionId,
): InspectSection | null {
  return model.sections.find((s) => s.id === id) ?? null;
}

// ── _debug namespace — internal table access for tests ─────────

/**
 * Internal table access for tests. NOT part of the public API. The
 * leading underscore signals "test-only".
 */
export const _debug = Object.freeze({
  INSPECT_SUGGESTED_MOVE,
  STAGE_EMPHASIZED_SECTION,
  resolveSectionBody,
});
