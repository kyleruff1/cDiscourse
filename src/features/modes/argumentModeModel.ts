/**
 * GAME-003 — Argument mode model (pure TypeScript).
 *
 * An "argument mode" is a consented, visible strictness profile both
 * parties choose at room setup before a 1v1 PvP argument becomes
 * interactive. A mode bundles a small set of room-rule fields (tone /
 * evidence strictness, turn pacing, allowed informality, branch
 * encouragement, source-request centrality, synthesis expectation,
 * permanent-record warning, semantic-classification level, cooldown,
 * observer access, invite-only) plus an optional plain-language
 * disclaimer.
 *
 * The doctrine that shapes this file:
 *
 *  - A mode is a CONSENTED ROOM RULE, never a verdict. It changes
 *    FRICTION, never truth. It NEVER declares a winner / loser and NEVER
 *    blocks a post on its own — validation blocks, modes do not. No export
 *    here turns a mode field into a blocking result.
 *  - `semanticClassification` defaults to `'off'` — the fail-closed value
 *    consistent with the MCP-012…MCP-016 semantic-referee posture.
 *  - All user-facing copy is plain language, read from `ARGUMENT_MODE_COPY`
 *    in `gameCopy.ts` — never authored inline. No internal enum value
 *    (`loose`, `restricted`, `metadata_and_chip`, …) reaches a
 *    user-facing string.
 *  - Every mode's `pacing` is built via GAME-002's `createPacingRule(...)`
 *    — never an object literal — so clamping / freezing stays centralized.
 *
 * This file is pure TS — NO React, NO Supabase, NO network, NO async, NO
 * mutation. JSON-serializable output. No DB table, no migration this card
 * (persisting the chosen mode is a later card).
 *
 * v1 ships the 4 MVP modes as `status: 'shipped'` live templates and the
 * other 9 as `status: 'design_only'` stubs — every stub still has a
 * fully-typed, doctrine-justified definition (design-only means
 * not-yet-selectable, never "fields are missing"). The mode SETUP SCREEN
 * is a named follow-up card (GAME-003B); this file is the model it consumes.
 */

import {
  type PacingRule,
  createPacingRule,
} from './pacingModel';
import { ARGUMENT_MODE_COPY } from '../arguments/gameCopy';

// ── Mode enum ────────────────────────────────────────────────────────────

/**
 * GAME-003 — the closed vocabulary of argument modes. 4 ship as live
 * templates this card; 9 ship as design-only stubs. The string values are
 * stable identifiers — they will become the persisted `debates.mode`
 * column value in a later card, so they must never change.
 */
export type ArgumentMode =
  | 'casual_disagreement' // friends arguing                      — MVP template
  | 'court_record_strict' // court-of-record strictness           — MVP template
  | 'internet_fact_check' // claim-by-claim source check          — MVP template
  | 'debate_club' // structured formal debate             — MVP template
  | 'domestic_bickering' // household dispute                    — design_only
  | 'co_parenting_custody' // co-parenting dispute (non-legal)     — design_only + disclaimer
  | 'political_debate' // political-issue argument             — design_only
  | 'historical_debate' // disputed historical question         — design_only
  | 'recollection_disconnect' // "you had to be there" memory clash   — design_only
  | 'workplace_decision' // workplace decision dispute           — design_only
  | 'research_evidence_review' // evidence-review / lit-review style    — design_only
  | 'relationship_repair' // relationship dispute (non-therapy)   — design_only + disclaimer
  | 'negotiation_tradeoff'; // negotiation / trade-off framing       — design_only

/** Frozen ordered list of every mode. Tests iterate this. */
export const ALL_ARGUMENT_MODES: ReadonlyArray<ArgumentMode> = Object.freeze([
  'casual_disagreement',
  'court_record_strict',
  'internet_fact_check',
  'debate_club',
  'domestic_bickering',
  'co_parenting_custody',
  'political_debate',
  'historical_debate',
  'recollection_disconnect',
  'workplace_decision',
  'research_evidence_review',
  'relationship_repair',
  'negotiation_tradeoff',
]);

/** The 4 modes that ship as live, fully-specified templates this card. */
export const MVP_ARGUMENT_MODES: ReadonlyArray<ArgumentMode> = Object.freeze([
  'casual_disagreement',
  'court_record_strict',
  'internet_fact_check',
  'debate_club',
]);

/** The 9 modes that ship as design-only stubs this card. */
export const DESIGN_ONLY_ARGUMENT_MODES: ReadonlyArray<ArgumentMode> =
  Object.freeze([
    'domestic_bickering',
    'co_parenting_custody',
    'political_debate',
    'historical_debate',
    'recollection_disconnect',
    'workplace_decision',
    'research_evidence_review',
    'relationship_repair',
    'negotiation_tradeoff',
  ]);

/**
 * The default mode for a brand-new 1v1 PvP room. Doctrine: the gentlest,
 * lowest-friction mode is the default — false positives are catastrophic
 * in casual modes, so the safe default is the most forgiving one.
 */
export const DEFAULT_ARGUMENT_MODE: ArgumentMode = 'casual_disagreement';

// ── Semantic-classification level ────────────────────────────────────────

/**
 * GAME-003 owns the canonical semantic-classification level. 'off' is the
 * fail-closed default — consistent with the MCP-012…MCP-016 semantic-
 * referee posture. MCP-012's `triggerGates.ts` keeps a local copy with
 * identical values; reconciling the import is out of this card's scope.
 *
 *  - 'off'               — no semantic-referee call originates from this room.
 *  - 'metadata_only'     — semantic referee may run; its output is advisory
 *                          metadata only, never surfaced as a chip.
 *  - 'metadata_and_chip' — semantic referee may run; its advisory output may
 *                          additionally render as a non-blocking chip.
 */
export type SemanticClassificationMode =
  | 'off'
  | 'metadata_only'
  | 'metadata_and_chip';

// ── Per-mode definition ──────────────────────────────────────────────────

/**
 * GAME-003 — the consented room-rule profile for one argument mode. Both
 * parties see and accept this (rendered in plain language) at room setup.
 * Immutable once a room is created. NEVER produces a winner/loser; NEVER
 * blocks a post on its own (validation blocks, modes do not).
 */
export type ArgumentModeDefinition = Readonly<{
  /** How strict tone expectations are. Affects helper copy only, never a block. */
  toneStrictness: 'loose' | 'normal' | 'strict';
  /** How strict source/evidence expectations are. Advisory strength, never a block. */
  evidenceStrictness: 'loose' | 'normal' | 'strict';
  /** GAME-002 turn-pacing rule. Built via createPacingRule(). */
  pacing: PacingRule;
  /** How permissive of slang / informal / "you had to be there" speech. */
  allowedInformality: 'permissive' | 'normal' | 'restricted';
  /** When true, side branches (BR-003) are encouraged rather than discouraged. */
  branchesEncouraged: boolean;
  /** When true, asking for a source is a first-class, foregrounded move. */
  sourceRequestsCentral: boolean;
  /** When true, the room nudges toward an explicit synthesis at the end. */
  finalSynthesisExpected: boolean;
  /** Mirrors the PacingRule's own 'permanent record' advisory toggle. */
  permanentRecordWarning: 'on' | 'off';
  /** Semantic-AI gating level — gates RULE-006 / MCP-012. Default 'off'. */
  semanticClassification: SemanticClassificationMode;
  /** When true, the room's PacingRule carries a non-zero cooldown. */
  cooldownEnabled: boolean;
  /** When true, observers may watch the room (Stage 6.4 observer model). */
  observerModeAllowed: boolean;
  /** When true, the room is invite-only (no public/gallery seat). */
  inviteOnly: boolean;
  /**
   * Optional plain-language NON-legal / NON-therapy / NON-medical
   * disclaimer. Present on sensitive modes. NEVER contains advice; only
   * states the app gives none. Read from ARGUMENT_MODE_COPY.
   */
  disclaimer?: string;
}>;

// ── Template wrapper ─────────────────────────────────────────────────────

/** Whether a mode is live-selectable or a documented-only stub. */
export type ArgumentModeStatus = 'shipped' | 'design_only';

/**
 * The full record for one mode: its stable id, its lifecycle status, its
 * (always fully-typed) definition, and whether it is a sensitive mode that
 * MUST carry a disclaimer.
 */
export type ArgumentModeTemplate = Readonly<{
  mode: ArgumentMode;
  /** 'shipped' = the 4 MVP modes; 'design_only' = the other 9. */
  status: ArgumentModeStatus;
  /**
   * True for modes whose subject matter touches legal / custody / therapy /
   * relationship territory. A sensitive mode MUST have a non-empty
   * `definition.disclaimer`. Enforced by argumentModeNoLegalAdvice.test.ts.
   */
  sensitive: boolean;
  /** The complete, fully-typed per-mode design fields. */
  definition: ArgumentModeDefinition;
}>;

// ── Setup-screen support types ───────────────────────────────────────────

/** One row of the "the rules" column — a plain-language rule statement. */
export type ModeRuleRow = Readonly<{
  /** Stable row id (e.g. 'tone', 'evidence', 'pacing'). For testIDs / keys. */
  id: string;
  /** Plain-language label, e.g. "Tone". Read from ARGUMENT_MODE_COPY. */
  label: string;
  /** Plain-language value, e.g. "Relaxed — slang and jokes are fine." */
  value: string;
}>;

// ── Internal builder ─────────────────────────────────────────────────────

/**
 * Internal helper. Builds a fully-frozen `ArgumentModeDefinition` from the
 * non-pacing fields plus a pacing rule. `cooldownEnabled` is DERIVED from
 * the constructed pacing rule (`cooldownAfterSendSec > 0`) so it can never
 * drift (edge case 6). `permanentRecordWarning` is taken from the pacing
 * rule so the two copies always agree (edge case 7) — callers pass the
 * matching `permanentRecordWarning` into `createPacingRule`.
 */
function buildDefinition(input: {
  toneStrictness: ArgumentModeDefinition['toneStrictness'];
  evidenceStrictness: ArgumentModeDefinition['evidenceStrictness'];
  pacing: PacingRule;
  allowedInformality: ArgumentModeDefinition['allowedInformality'];
  branchesEncouraged: boolean;
  sourceRequestsCentral: boolean;
  finalSynthesisExpected: boolean;
  semanticClassification: SemanticClassificationMode;
  observerModeAllowed: boolean;
  inviteOnly: boolean;
  disclaimer?: string;
}): ArgumentModeDefinition {
  const base: ArgumentModeDefinition = {
    toneStrictness: input.toneStrictness,
    evidenceStrictness: input.evidenceStrictness,
    pacing: input.pacing,
    allowedInformality: input.allowedInformality,
    branchesEncouraged: input.branchesEncouraged,
    sourceRequestsCentral: input.sourceRequestsCentral,
    finalSynthesisExpected: input.finalSynthesisExpected,
    // Synced with the pacing rule — never hand-typed (edge case 7).
    permanentRecordWarning: input.pacing.permanentRecordWarning,
    semanticClassification: input.semanticClassification,
    // Derived from the constructed pacing rule — never hand-typed (edge case 6).
    cooldownEnabled: input.pacing.cooldownAfterSendSec > 0,
    observerModeAllowed: input.observerModeAllowed,
    inviteOnly: input.inviteOnly,
    ...(input.disclaimer !== undefined ? { disclaimer: input.disclaimer } : {}),
  };
  return Object.freeze(base);
}

// ── The 13 mode templates ────────────────────────────────────────────────

/**
 * The frozen registry of all 13 mode templates, keyed by mode id. The
 * single source of truth — every other accessor reads from this. The 4
 * MVP modes are `status: 'shipped'`; the other 9 are `status:
 * 'design_only'` (fully-typed, just not yet live-selectable).
 */
export const ARGUMENT_MODE_TEMPLATES: Readonly<
  Record<ArgumentMode, ArgumentModeTemplate>
> = Object.freeze({
  // ── 1. casual_disagreement — the default. Friends arguing. ──
  // Doctrine: false positives are catastrophic in casual modes, so every
  // value is the gentlest setting. No pacing (provable no-op), no record.
  casual_disagreement: Object.freeze({
    mode: 'casual_disagreement',
    status: 'shipped',
    sensitive: false,
    definition: buildDefinition({
      toneStrictness: 'loose',
      evidenceStrictness: 'loose',
      pacing: createPacingRule(),
      allowedInformality: 'permissive',
      branchesEncouraged: true,
      sourceRequestsCentral: false,
      finalSynthesisExpected: false,
      semanticClassification: 'off',
      observerModeAllowed: true,
      inviteOnly: false,
    }),
  }),

  // ── 2. court_record_strict — strict, formal, on-the-record. ──
  // A STYLE mode (a strict, careful, record-keeping format), NOT a real
  // legal matter — gives no legal advice, carries no disclaimer. A 2-min
  // cooldown + cooldown weighting buys framing time (GAME-002 "clear
  // payoff" doctrine); a 24h response window structures turns.
  court_record_strict: Object.freeze({
    mode: 'court_record_strict',
    status: 'shipped',
    sensitive: false,
    definition: buildDefinition({
      toneStrictness: 'strict',
      evidenceStrictness: 'strict',
      pacing: createPacingRule({
        cooldownAfterSendSec: 120,
        responseWindowSec: 86400,
        weightedByCooldown: true,
        permanentRecordWarning: 'on',
      }),
      allowedInformality: 'restricted',
      branchesEncouraged: false,
      sourceRequestsCentral: true,
      finalSynthesisExpected: true,
      semanticClassification: 'metadata_only',
      observerModeAllowed: true,
      inviteOnly: true,
    }),
  }),

  // ── 3. internet_fact_check — claim-by-claim source checking. ──
  // Evidence is central; pacing stays light so a fast "source?" / "here it
  // is" volley flows. Anti-amplification doctrine is load-bearing — the
  // mode foregrounds EVIDENCE, never virality / popularity.
  internet_fact_check: Object.freeze({
    mode: 'internet_fact_check',
    status: 'shipped',
    sensitive: false,
    definition: buildDefinition({
      toneStrictness: 'normal',
      evidenceStrictness: 'strict',
      pacing: createPacingRule(),
      allowedInformality: 'normal',
      branchesEncouraged: true,
      sourceRequestsCentral: true,
      finalSynthesisExpected: false,
      // The one mode where a non-blocking advisory chip ("this claim has
      // no source attached yet") genuinely helps — still advisory, never a
      // block, never a truth verdict.
      semanticClassification: 'metadata_and_chip',
      observerModeAllowed: true,
      inviteOnly: false,
    }),
  }),

  // ── 4. debate_club — structured formal debate practice. ──
  // Rigorous but friendly — practice, not a real-stakes record. A short
  // 30s cooldown enforces gentle turn-taking; a 12h window keeps the round
  // moving. No cooldown weighting — debate club rewards the argument.
  debate_club: Object.freeze({
    mode: 'debate_club',
    status: 'shipped',
    sensitive: false,
    definition: buildDefinition({
      toneStrictness: 'normal',
      evidenceStrictness: 'normal',
      pacing: createPacingRule({
        cooldownAfterSendSec: 30,
        responseWindowSec: 43200,
        weightedByCooldown: false,
        permanentRecordWarning: 'on',
      }),
      allowedInformality: 'normal',
      branchesEncouraged: true,
      sourceRequestsCentral: false,
      finalSynthesisExpected: true,
      semanticClassification: 'metadata_only',
      observerModeAllowed: true,
      inviteOnly: false,
    }),
  }),

  // ── 5. domestic_bickering (design_only) — a household disagreement. ──
  // Like casual_disagreement but the parties are co-resident; kept distinct
  // only so the picker description can name the household context.
  domestic_bickering: Object.freeze({
    mode: 'domestic_bickering',
    status: 'design_only',
    sensitive: false,
    definition: buildDefinition({
      toneStrictness: 'loose',
      evidenceStrictness: 'loose',
      pacing: createPacingRule(),
      allowedInformality: 'permissive',
      branchesEncouraged: true,
      sourceRequestsCentral: false,
      finalSynthesisExpected: false,
      semanticClassification: 'off',
      observerModeAllowed: false,
      inviteOnly: false,
    }),
  }),

  // ── 6. co_parenting_custody (design_only, SENSITIVE) — non-legal. ──
  // A real, high-stakes interpersonal dispute. A 5-min cooldown lowers
  // heat; the record warning is honest; inviteOnly keeps it private;
  // branches off keeps it on the one decision. semanticClassification
  // 'off' — never run AI advisories on a custody dispute. Carries the
  // non-legal disclaimer (design-only copy).
  co_parenting_custody: Object.freeze({
    mode: 'co_parenting_custody',
    status: 'design_only',
    sensitive: true,
    definition: buildDefinition({
      toneStrictness: 'normal',
      evidenceStrictness: 'normal',
      pacing: createPacingRule({
        cooldownAfterSendSec: 300,
        permanentRecordWarning: 'on',
      }),
      allowedInformality: 'normal',
      branchesEncouraged: false,
      sourceRequestsCentral: true,
      finalSynthesisExpected: true,
      semanticClassification: 'off',
      observerModeAllowed: false,
      inviteOnly: true,
      disclaimer: ARGUMENT_MODE_COPY.disclaimer_co_parenting_custody,
    }),
  }),

  // ── 7. political_debate (design_only) — a political-issue argument. ──
  // evidenceStrictness 'strict' because anti-amplification matters most
  // here (popularity / virality is not evidence); a 60s cooldown cools
  // reactivity. semanticClassification 'metadata_only' — advisory, never a
  // chip, never a verdict on a political claim. Design-only specifically
  // because it needs careful operator review before going live.
  political_debate: Object.freeze({
    mode: 'political_debate',
    status: 'design_only',
    sensitive: false,
    definition: buildDefinition({
      toneStrictness: 'normal',
      evidenceStrictness: 'strict',
      pacing: createPacingRule({
        cooldownAfterSendSec: 60,
        permanentRecordWarning: 'on',
      }),
      allowedInformality: 'normal',
      branchesEncouraged: true,
      sourceRequestsCentral: true,
      finalSynthesisExpected: false,
      semanticClassification: 'metadata_only',
      observerModeAllowed: true,
      inviteOnly: false,
    }),
  }),

  // ── 8. historical_debate (design_only) — a disputed historical question. ──
  // Worked through with sources; a wrap-up names where things landed.
  historical_debate: Object.freeze({
    mode: 'historical_debate',
    status: 'design_only',
    sensitive: false,
    definition: buildDefinition({
      toneStrictness: 'normal',
      evidenceStrictness: 'strict',
      pacing: createPacingRule(),
      allowedInformality: 'normal',
      branchesEncouraged: true,
      sourceRequestsCentral: true,
      finalSynthesisExpected: true,
      semanticClassification: 'metadata_only',
      observerModeAllowed: true,
      inviteOnly: false,
    }),
  }),

  // ── 9. recollection_disconnect (design_only) — a memory clash. ──
  // The "you had to be there" memory clash. loose / permissive by design:
  // the doctrine protects natural recollection speech. evidenceStrictness
  // 'loose' — you cannot source a memory. finalSynthesisExpected true: the
  // useful end-state is "we remember it differently, here is what we agree
  // on."
  recollection_disconnect: Object.freeze({
    mode: 'recollection_disconnect',
    status: 'design_only',
    sensitive: false,
    definition: buildDefinition({
      toneStrictness: 'loose',
      evidenceStrictness: 'loose',
      pacing: createPacingRule(),
      allowedInformality: 'permissive',
      branchesEncouraged: true,
      sourceRequestsCentral: false,
      finalSynthesisExpected: true,
      semanticClassification: 'off',
      observerModeAllowed: false,
      inviteOnly: true,
    }),
  }),

  // ── 10. workplace_decision (design_only) — a workplace decision dispute. ──
  // Talked through carefully between two people; the room stays on the one
  // decision; a wrap-up records what was chosen.
  workplace_decision: Object.freeze({
    mode: 'workplace_decision',
    status: 'design_only',
    sensitive: false,
    definition: buildDefinition({
      toneStrictness: 'normal',
      evidenceStrictness: 'normal',
      pacing: createPacingRule({
        cooldownAfterSendSec: 60,
        responseWindowSec: 86400,
        permanentRecordWarning: 'on',
      }),
      allowedInformality: 'normal',
      branchesEncouraged: false,
      sourceRequestsCentral: true,
      finalSynthesisExpected: true,
      semanticClassification: 'metadata_only',
      observerModeAllowed: false,
      inviteOnly: true,
    }),
  }),

  // ── 11. research_evidence_review (design_only) — lit-review style. ──
  // The strictest evidence posture; a 48h response window for considered
  // replies; metadata_and_chip because evidence chips genuinely help a
  // lit-review-style room.
  research_evidence_review: Object.freeze({
    mode: 'research_evidence_review',
    status: 'design_only',
    sensitive: false,
    definition: buildDefinition({
      toneStrictness: 'strict',
      evidenceStrictness: 'strict',
      pacing: createPacingRule({
        responseWindowSec: 172800,
        permanentRecordWarning: 'on',
      }),
      allowedInformality: 'restricted',
      branchesEncouraged: true,
      sourceRequestsCentral: true,
      finalSynthesisExpected: true,
      semanticClassification: 'metadata_and_chip',
      observerModeAllowed: true,
      inviteOnly: true,
    }),
  }),

  // ── 12. relationship_repair (design_only, SENSITIVE) — non-therapy. ──
  // permissive informality (people repair relationships in their own
  // words), evidenceStrictness 'loose' (feelings are not sourced), a long
  // 10-min cooldown to lower heat, finalSynthesisExpected true (the point
  // is a shared understanding). Carries the non-therapy disclaimer
  // (design-only copy).
  relationship_repair: Object.freeze({
    mode: 'relationship_repair',
    status: 'design_only',
    sensitive: true,
    definition: buildDefinition({
      toneStrictness: 'normal',
      evidenceStrictness: 'loose',
      pacing: createPacingRule({
        cooldownAfterSendSec: 600,
        permanentRecordWarning: 'on',
      }),
      allowedInformality: 'permissive',
      branchesEncouraged: false,
      sourceRequestsCentral: false,
      finalSynthesisExpected: true,
      semanticClassification: 'off',
      observerModeAllowed: false,
      inviteOnly: true,
      disclaimer: ARGUMENT_MODE_COPY.disclaimer_relationship_repair,
    }),
  }),

  // ── 13. negotiation_tradeoff (design_only) — a trade-off negotiation. ──
  // finalSynthesisExpected true (a negotiation ends in an agreed
  // trade-off); branchesEncouraged true (trade-offs branch into sub-terms).
  negotiation_tradeoff: Object.freeze({
    mode: 'negotiation_tradeoff',
    status: 'design_only',
    sensitive: false,
    definition: buildDefinition({
      toneStrictness: 'normal',
      evidenceStrictness: 'normal',
      pacing: createPacingRule({
        cooldownAfterSendSec: 120,
        permanentRecordWarning: 'on',
      }),
      allowedInformality: 'normal',
      branchesEncouraged: true,
      sourceRequestsCentral: true,
      finalSynthesisExpected: true,
      semanticClassification: 'metadata_only',
      observerModeAllowed: false,
      inviteOnly: true,
    }),
  }),
});

// ── Accessors ────────────────────────────────────────────────────────────

/**
 * Returns the full template for a mode. Pure O(1) lookup. Throws on an
 * unknown mode value — the union makes that unreachable from typed
 * callers; the throw guards untyped (e.g. DB-string) boundaries. Use
 * `coerceArgumentMode` at any untyped boundary.
 */
export function argumentModeTemplate(mode: ArgumentMode): ArgumentModeTemplate {
  const template = ARGUMENT_MODE_TEMPLATES[mode];
  if (!template) {
    throw new Error(`Unknown argument mode: ${String(mode)}`);
  }
  return template;
}

/**
 * Returns just the per-mode design fields. Sugar over
 * `argumentModeTemplate(mode).definition`. Throws on an unknown mode.
 */
export function argumentModeDefinition(
  mode: ArgumentMode,
): ArgumentModeDefinition {
  return argumentModeTemplate(mode).definition;
}

/** True when the mode is one of the 4 live MVP templates. */
export function isShippedMode(mode: ArgumentMode): boolean {
  const template = ARGUMENT_MODE_TEMPLATES[mode];
  return !!template && template.status === 'shipped';
}

/** True when the mode is a sensitive (legal/custody/therapy-adjacent) mode. */
export function isSensitiveMode(mode: ArgumentMode): boolean {
  const template = ARGUMENT_MODE_TEMPLATES[mode];
  return !!template && template.sensitive === true;
}

/**
 * Narrows an arbitrary value (e.g. a DB column value, or a deep-link
 * param) to an `ArgumentMode`, falling back to `DEFAULT_ARGUMENT_MODE` for
 * any unknown or non-string input. Fail-safe — never throws.
 */
export function coerceArgumentMode(value: unknown): ArgumentMode {
  if (typeof value !== 'string') return DEFAULT_ARGUMENT_MODE;
  if (Object.prototype.hasOwnProperty.call(ARGUMENT_MODE_TEMPLATES, value)) {
    return value as ArgumentMode;
  }
  return DEFAULT_ARGUMENT_MODE;
}

// ── Setup-screen support functions ───────────────────────────────────────

/**
 * The mode's plain-language display name (e.g. "Friendly disagreement").
 * Read from `ARGUMENT_MODE_COPY` — never authored inline.
 */
export function argumentModeDisplayName(mode: ArgumentMode): string {
  const key = `name_${mode}` as keyof typeof ARGUMENT_MODE_COPY;
  return ARGUMENT_MODE_COPY[key];
}

/** The mode's one-line plain-language description for the picker. */
export function argumentModeDescription(mode: ArgumentMode): string {
  const key = `desc_${mode}` as keyof typeof ARGUMENT_MODE_COPY;
  return ARGUMENT_MODE_COPY[key];
}

/** Internal: map `toneStrictness` to its plain-language rule value. */
function toneRuleValue(
  tone: ArgumentModeDefinition['toneStrictness'],
): string {
  if (tone === 'loose') return ARGUMENT_MODE_COPY.rule_value_tone_loose;
  if (tone === 'strict') return ARGUMENT_MODE_COPY.rule_value_tone_strict;
  return ARGUMENT_MODE_COPY.rule_value_tone_normal;
}

/** Internal: map `evidenceStrictness` to its plain-language rule value. */
function evidenceRuleValue(
  evidence: ArgumentModeDefinition['evidenceStrictness'],
): string {
  if (evidence === 'loose') return ARGUMENT_MODE_COPY.rule_value_evidence_loose;
  if (evidence === 'strict') {
    return ARGUMENT_MODE_COPY.rule_value_evidence_strict;
  }
  return ARGUMENT_MODE_COPY.rule_value_evidence_normal;
}

/** Internal: map `allowedInformality` to its plain-language rule value. */
function informalityRuleValue(
  informality: ArgumentModeDefinition['allowedInformality'],
): string {
  if (informality === 'permissive') {
    return ARGUMENT_MODE_COPY.rule_value_informality_permissive;
  }
  if (informality === 'restricted') {
    return ARGUMENT_MODE_COPY.rule_value_informality_restricted;
  }
  return ARGUMENT_MODE_COPY.rule_value_informality_normal;
}

/** Internal: map `semanticClassification` to its plain-language rule value. */
function semanticRuleValue(semantic: SemanticClassificationMode): string {
  if (semantic === 'metadata_only') {
    return ARGUMENT_MODE_COPY.rule_value_semantic_metadata_only;
  }
  if (semantic === 'metadata_and_chip') {
    return ARGUMENT_MODE_COPY.rule_value_semantic_metadata_and_chip;
  }
  return ARGUMENT_MODE_COPY.rule_value_semantic_off;
}

/**
 * Builds the ordered, plain-language rule rows for the "the rules" column
 * of the mode setup screen. Pure. Reads only `ARGUMENT_MODE_COPY` + the
 * mode's definition. No verdict tokens; no internal code leaks (every enum
 * value is mapped to prose). The row `id` set is identical across all 13
 * modes (a stable row schema). This is the data the part-B screen renders.
 */
export function buildModeRuleRows(
  mode: ArgumentMode,
): ReadonlyArray<ModeRuleRow> {
  const def = argumentModeDefinition(mode);
  const hasPacing = def.pacing.cooldownAfterSendSec > 0;
  return Object.freeze([
    Object.freeze({
      id: 'tone',
      label: ARGUMENT_MODE_COPY.rule_label_tone,
      value: toneRuleValue(def.toneStrictness),
    }),
    Object.freeze({
      id: 'evidence',
      label: ARGUMENT_MODE_COPY.rule_label_evidence,
      value: evidenceRuleValue(def.evidenceStrictness),
    }),
    Object.freeze({
      id: 'pacing',
      label: ARGUMENT_MODE_COPY.rule_label_pacing,
      value: hasPacing
        ? ARGUMENT_MODE_COPY.rule_value_pacing_paced
        : ARGUMENT_MODE_COPY.rule_value_pacing_none,
    }),
    Object.freeze({
      id: 'informality',
      label: ARGUMENT_MODE_COPY.rule_label_informality,
      value: informalityRuleValue(def.allowedInformality),
    }),
    Object.freeze({
      id: 'branches',
      label: ARGUMENT_MODE_COPY.rule_label_branches,
      value: def.branchesEncouraged
        ? ARGUMENT_MODE_COPY.rule_value_branches_yes
        : ARGUMENT_MODE_COPY.rule_value_branches_no,
    }),
    Object.freeze({
      id: 'source_requests',
      label: ARGUMENT_MODE_COPY.rule_label_source_requests,
      value: def.sourceRequestsCentral
        ? ARGUMENT_MODE_COPY.rule_value_source_central
        : ARGUMENT_MODE_COPY.rule_value_source_not_central,
    }),
    Object.freeze({
      id: 'synthesis',
      label: ARGUMENT_MODE_COPY.rule_label_synthesis,
      value: def.finalSynthesisExpected
        ? ARGUMENT_MODE_COPY.rule_value_synthesis_yes
        : ARGUMENT_MODE_COPY.rule_value_synthesis_no,
    }),
    Object.freeze({
      id: 'permanent_record',
      label: ARGUMENT_MODE_COPY.rule_label_permanent_record,
      value:
        def.permanentRecordWarning === 'on'
          ? ARGUMENT_MODE_COPY.rule_value_record_on
          : ARGUMENT_MODE_COPY.rule_value_record_off,
    }),
    Object.freeze({
      id: 'semantic',
      label: ARGUMENT_MODE_COPY.rule_label_semantic,
      value: semanticRuleValue(def.semanticClassification),
    }),
    Object.freeze({
      id: 'observers',
      label: ARGUMENT_MODE_COPY.rule_label_observers,
      value: def.observerModeAllowed
        ? ARGUMENT_MODE_COPY.rule_value_observers_yes
        : ARGUMENT_MODE_COPY.rule_value_observers_no,
    }),
    Object.freeze({
      id: 'invite_only',
      label: ARGUMENT_MODE_COPY.rule_label_invite_only,
      value: def.inviteOnly
        ? ARGUMENT_MODE_COPY.rule_value_invite_yes
        : ARGUMENT_MODE_COPY.rule_value_invite_no,
    }),
  ]);
}

/**
 * Collapses a mode's `allowedInformality` to the legacy 'casual' |
 * 'strict' value RULE-004 (`PreSendReviewSheet`) and RULE-005 (channel
 * model) still accept. 'restricted' informality → 'strict'; 'permissive'
 * and 'normal' → 'casual'. Part B uses this to pass the real mode through
 * the existing RULE-004/RULE-005 signatures without changing their types.
 *
 * Rationale for 'normal' → 'casual': RULE-004's only mode-sensitive
 * behaviour is upgrading the permanent-record-warning severity in strict
 * mode. That upgrade should apply only to genuinely formal/court modes
 * (`restricted`), not to `debate_club`'s `normal` informality.
 */
export function reviewModeForArgumentMode(
  mode: ArgumentMode,
): 'casual' | 'strict' {
  return argumentModeDefinition(mode).allowedInformality === 'restricted'
    ? 'strict'
    : 'casual';
}

// ── Doctrine ban-list helper ─────────────────────────────────────────────

/**
 * The verdict / amplification / block / person-attribution token set this
 * card's user-facing copy must never contain. A test-support helper for
 * `argumentModeBanList.test.ts` — NOT a content filter. Mirrors
 * `_forbiddenChannelTokens` / `_forbiddenPreSendTokens` /
 * `_forbiddenTangentTokens` so GAME-003 copy is held to the same bar.
 */
export function _forbiddenArgumentModeTokens(): string[] {
  return [
    // Verdict tokens
    'winner',
    'loser',
    'correct',
    'incorrect',
    'true',
    'false',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'troll',
    'bot',
    'astroturfer',
    'verdict',
    'proof',
    'proven',
    'won',
    'lost',
    'defeated',
    'right',
    'wrong',
    'validated',
    // Amplification tokens
    'likes',
    'retweets',
    'shares',
    'views',
    'followers',
    'verified',
    'engagement',
    'amplification',
    'trending',
    'virality',
    'popular',
    'viral',
    // Block tokens
    'block',
    'prevent',
    'reject',
    'forbid',
    'disallow',
    'denied',
    // Person-attribution / punitive tokens
    'dodge',
    'evade',
    'evasion',
    'avoiding',
  ];
}
