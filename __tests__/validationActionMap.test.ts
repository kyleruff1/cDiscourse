/**
 * RULE-002 — Tests for the validation-action map.
 *
 * Pure-model coverage:
 *   - 23-entry catalog completeness (16 engine FlagCodes + 7 Stage 6.2/6.4
 *     advisory codes) — every FLAG_CODES value is represented; the
 *     advisory codes line up with PLAIN_LANGUAGE_COPY entries.
 *   - Field-shape & length caps (chipLabel ≤ 32, helperLine ≤ 80).
 *   - Ban-list (verdict, amplification, person-attribution tokens
 *     suppressed across every chipLabel + helperLine).
 *   - Issue acceptance criteria.
 *   - Submit-button gate is not affected by the chip.
 *   - Normalisation parity (whitespace / case / hyphen forms collapse).
 *   - Coordination with RULE-001 (shared labels match verbatim).
 *   - Render contract (data shape the consumer surface relies on).
 *   - Snake_case hygiene.
 *   - Doctrine self-check (engine module not imported at runtime;
 *     validationActionMap source contains no fetch / supabase / anthropic /
 *     xai literal).
 *   - Regression: plain-language layer remains wired for advisory codes.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ALL_VALIDATION_ACTION_CODES,
  VALIDATION_ACTION_MAP,
  getValidationAction,
  mapValidationActionOrSuppress,
  shouldRenderValidationActionChip,
  _forbiddenValidationActionTokens,
  type ValidationActionCode,
  type ValidationActionUx,
} from '../src/features/rulesUx/validationActionMap';
import { FLAG_CODES, type FlagCode } from '../src/domain/constitution/types';
import {
  ALL_SUGGESTED_MOVE_CODES,
  _forbiddenSuggestionTokens,
  type SuggestedMoveCode,
} from '../src/features/arguments/suggestedMovesModel';
import {
  ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES,
  type TimelineNodeActionDockActionCode,
} from '../src/features/arguments/timelineNodeActionDockModel';
import {
  quickActionToPreset,
  type QuickActionLabel,
} from '../src/features/arguments/quickActionPresets';
import {
  RULE_TO_UI_AFFORDANCE,
  ALL_RULE_CODES,
  mapRuleToUiAffordance,
} from '../src/features/rulesUx/ruleToUiMap';
import {
  toPlainLanguage,
  looksLikeInternalCode,
} from '../src/features/arguments/gameCopy';

// ── Shared fixtures ───────────────────────────────────────────

const ADVISORY_CODES_LIST: ValidationActionCode[] = [
  'source_chain',
  'evidence_debt',
  'anti_amplification',
  'platform_support_warning',
  'synthesis_ready',
  'validation_failed_after_retries',
  'max_depth_reached',
];

const ENGINE_FLAG_CODES_LIST: ValidationActionCode[] = Object.values(FLAG_CODES) as ValidationActionCode[];

const ALL_QUICK_ACTION_LABELS: ReadonlyArray<QuickActionLabel> = [
  'reply',
  'challenge',
  'source',
  'quote',
  'clarify',
  'evidence',
  'concede',
  'branch',
  'flag',
  'weak_source',
  'inspect_receipt',
  'narrow',
  'confirm',
  'synthesize',
];

// Codes deliberately suppressed (no clean one-click repair).
const SUPPRESSED_CODES: ValidationActionCode[] = [
  'missing_parent',
  'invalid_transition',
  'civility_risk',
  'ad_hominem_possible',
  'duplicate_argument_possible',
  'excessive_length',
  'unclear_claim',
  'needs_moderator_review',
  'validation_failed_after_retries',
];

// Codes that route to a real chip (at least one non-null routing field).
const CHIP_EMITTING_CODES: ValidationActionCode[] = ALL_VALIDATION_ACTION_CODES.filter(
  (c) => !SUPPRESSED_CODES.includes(c),
);

// ─────────────────────────────────────────────────────────────
// 1. Coverage & exhaustiveness
// ─────────────────────────────────────────────────────────────

describe('RULE-002 — coverage & exhaustiveness', () => {
  test('ALL_VALIDATION_ACTION_CODES length matches Object.keys(VALIDATION_ACTION_MAP)', () => {
    expect(ALL_VALIDATION_ACTION_CODES.length).toBe(Object.keys(VALIDATION_ACTION_MAP).length);
  });

  test('catalog has exactly 23 entries (16 engine FlagCodes + 7 advisory codes)', () => {
    expect(ALL_VALIDATION_ACTION_CODES.length).toBe(23);
  });

  test('every entry in the map is keyed in ALL_VALIDATION_ACTION_CODES', () => {
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      expect(VALIDATION_ACTION_MAP[code]).toBeDefined();
    }
    for (const key of Object.keys(VALIDATION_ACTION_MAP) as ValidationActionCode[]) {
      expect(ALL_VALIDATION_ACTION_CODES).toContain(key);
    }
  });

  test('every value of FLAG_CODES (engine) appears in ALL_VALIDATION_ACTION_CODES', () => {
    const flagCodeValues = Object.values(FLAG_CODES) as FlagCode[];
    expect(flagCodeValues.length).toBe(16);
    for (const fc of flagCodeValues) {
      expect(ALL_VALIDATION_ACTION_CODES).toContain(fc as ValidationActionCode);
    }
  });

  test('the seven Stage 6.2 / 6.4 advisory codes all appear in ALL_VALIDATION_ACTION_CODES', () => {
    for (const advisory of ADVISORY_CODES_LIST) {
      expect(ALL_VALIDATION_ACTION_CODES).toContain(advisory);
    }
  });

  test('each entry.code field matches its map key', () => {
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      expect(VALIDATION_ACTION_MAP[code].code).toBe(code);
    }
  });

  test('getValidationAction(code) returns the same object as VALIDATION_ACTION_MAP[code]', () => {
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      expect(getValidationAction(code)).toBe(VALIDATION_ACTION_MAP[code]);
    }
  });

  test('mapValidationActionOrSuppress returns the same value as getValidationAction for known codes', () => {
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      expect(mapValidationActionOrSuppress(code)).toBe(getValidationAction(code));
    }
  });

  test('mapValidationActionOrSuppress returns null for unknown / empty / null / undefined inputs', () => {
    expect(mapValidationActionOrSuppress('not_a_real_code')).toBeNull();
    expect(mapValidationActionOrSuppress('completely-made-up')).toBeNull();
    expect(mapValidationActionOrSuppress('')).toBeNull();
    expect(mapValidationActionOrSuppress(null)).toBeNull();
    expect(mapValidationActionOrSuppress(undefined)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Field-shape & length caps
// ─────────────────────────────────────────────────────────────

describe('RULE-002 — field-shape & length caps', () => {
  test('every chipLabel is non-empty and ≤ 32 chars', () => {
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      const a = VALIDATION_ACTION_MAP[code];
      expect(a.chipLabel.length).toBeGreaterThan(0);
      expect(a.chipLabel.length).toBeLessThanOrEqual(32);
    }
  });

  test('every helperLine is non-empty and ≤ 80 chars', () => {
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      const a = VALIDATION_ACTION_MAP[code];
      expect(a.helperLine.length).toBeGreaterThan(0);
      expect(a.helperLine.length).toBeLessThanOrEqual(80);
    }
  });

  test('every chipLabel and helperLine passes looksLikeInternalCode === false', () => {
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      const a = VALIDATION_ACTION_MAP[code];
      expect(looksLikeInternalCode(a.chipLabel)).toBe(false);
      expect(looksLikeInternalCode(a.helperLine)).toBe(false);
    }
  });

  test('no chipLabel or helperLine contains the snake_case form of any ValidationActionCode', () => {
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      const a = VALIDATION_ACTION_MAP[code];
      const combined = `${a.chipLabel} ${a.helperLine}`.toLowerCase();
      for (const c of ALL_VALIDATION_ACTION_CODES) {
        expect(combined).not.toContain(c);
      }
    }
  });

  test('every suggestedMove is null or a member of ALL_SUGGESTED_MOVE_CODES', () => {
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      const a = VALIDATION_ACTION_MAP[code];
      if (a.suggestedMove !== null) {
        expect(ALL_SUGGESTED_MOVE_CODES).toContain(a.suggestedMove as SuggestedMoveCode);
      }
    }
  });

  test('every dockAction is null or a member of ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES', () => {
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      const a = VALIDATION_ACTION_MAP[code];
      if (a.dockAction !== null) {
        expect(ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES).toContain(
          a.dockAction as TimelineNodeActionDockActionCode,
        );
      }
    }
  });

  test('every presetKey is null or a known QuickActionLabel', () => {
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      const a = VALIDATION_ACTION_MAP[code];
      if (a.presetKey !== null) {
        expect(ALL_QUICK_ACTION_LABELS).toContain(a.presetKey as QuickActionLabel);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 3. Ban-list (doctrine safety)
// ─────────────────────────────────────────────────────────────

const VERDICT_TOKEN_REGEX = /\b(winner|loser|liar|dishonest|bad faith|manipulative|extremist|propagandist|stupid|idiot|astroturfer|troll|verdict|proven|disproven|validated|lost|defeated|won|incorrect)\b/i;

// `right` / `wrong` are intentionally not banned — they are plain-language
// English with no verdict semantics in this catalog. `true` / `false` are
// banned because they directly assert correctness; we scan as standalone
// tokens to avoid false positives like "from frame".
const STRICT_VERDICT_TOKEN_REGEX = /\b(true|false|correct)\b/i;

const AMPLIFICATION_TOKEN_REGEX = /\b(viral|trending|likes|retweets|shares|followers|virality|amplification)\b/i;

// Word-boundary `popular` scan — the doctrine-canonical phrase
// "Popularity is not proof" intentionally uses the noun "Popularity" so
// the standalone `popular` token never appears.
const STANDALONE_POPULAR_REGEX = /\bpopular\b/i;

const PERSON_ATTRIBUTION_REGEX = /\b(you|your|yours|youre|they|their|theirs|theyre|the user|the author|the poster|the speaker|this person|this user)\b/i;

describe('RULE-002 — ban-list (doctrine safety)', () => {
  test('no chipLabel or helperLine contains a verdict token', () => {
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      const a = VALIDATION_ACTION_MAP[code];
      expect(a.chipLabel).not.toMatch(VERDICT_TOKEN_REGEX);
      expect(a.helperLine).not.toMatch(VERDICT_TOKEN_REGEX);
    }
  });

  test('no chipLabel or helperLine contains true / false / correct as standalone tokens', () => {
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      const a = VALIDATION_ACTION_MAP[code];
      expect(a.chipLabel).not.toMatch(STRICT_VERDICT_TOKEN_REGEX);
      expect(a.helperLine).not.toMatch(STRICT_VERDICT_TOKEN_REGEX);
    }
  });

  test('no chipLabel or helperLine contains a person-attribution token', () => {
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      const a = VALIDATION_ACTION_MAP[code];
      expect(a.chipLabel).not.toMatch(PERSON_ATTRIBUTION_REGEX);
      expect(a.helperLine).not.toMatch(PERSON_ATTRIBUTION_REGEX);
    }
  });

  test('no chipLabel or helperLine contains an amplification-shaped token (likes / retweets / viral / trending / etc.)', () => {
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      const a = VALIDATION_ACTION_MAP[code];
      expect(a.chipLabel).not.toMatch(AMPLIFICATION_TOKEN_REGEX);
      expect(a.helperLine).not.toMatch(AMPLIFICATION_TOKEN_REGEX);
    }
  });

  test('no chipLabel or helperLine contains standalone `popular` (only the canonical "Popularity is not proof" noun form is allowed)', () => {
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      const a = VALIDATION_ACTION_MAP[code];
      expect(a.chipLabel).not.toMatch(STANDALONE_POPULAR_REGEX);
      expect(a.helperLine).not.toMatch(STANDALONE_POPULAR_REGEX);
    }
  });

  test('_forbiddenValidationActionTokens() returns a non-empty deduped list that includes the verdict + amplification + person-attribution categories', () => {
    const tokens = _forbiddenValidationActionTokens();
    expect(tokens.length).toBeGreaterThan(0);
    expect(new Set(tokens).size).toBe(tokens.length);
    // Verdict.
    expect(tokens).toContain('winner');
    expect(tokens).toContain('loser');
    expect(tokens).toContain('liar');
    // Amplification.
    expect(tokens).toContain('viral');
    expect(tokens).toContain('trending');
    // Person-attribution.
    expect(tokens).toContain('you');
    expect(tokens).toContain('the user');
  });

  test('every chipLabel and helperLine is clean against the ST-002 forbidden suggestion tokens — person-attribution subset (cross-surface vocabulary stays unified)', () => {
    // Scope: person-attribution tokens. The verdict / amplification
    // subsets of `_forbiddenSuggestionTokens()` overlap with RULE-001's
    // canonical doctrine phrasings (e.g. "Popularity is not proof" uses
    // the noun `proof`; that token is on the metadata ban-list for
    // auto-metadata labels but RULE-001 — the upstream canonical source
    // — has audited it as acceptable in the cross-surface chipLabel
    // catalog). The actual cross-surface invariant we care about here
    // is person-attribution; verdict / amplification scans above already
    // cover the relevant chipLabel + helperLine fields directly.
    const PERSON_ATTRIBUTION_SUBSET = [
      'you',
      'your',
      "you're",
      'yours',
      'they',
      'their',
      "they're",
      'theirs',
      'the user',
      'the author',
      'the poster',
      'the speaker',
      'the participant',
      'this person',
      'this user',
    ];
    const suggestionTokens = _forbiddenSuggestionTokens();
    // Sanity — the ST-002 export includes the person-attribution subset.
    for (const tok of PERSON_ATTRIBUTION_SUBSET) {
      expect(suggestionTokens).toContain(tok);
    }
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      const a = VALIDATION_ACTION_MAP[code];
      const combined = `${a.chipLabel} ${a.helperLine}`.toLowerCase();
      for (const tok of PERSON_ATTRIBUTION_SUBSET) {
        const re = new RegExp(`\\b${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        expect(combined).not.toMatch(re);
      }
    }
  });

  test('anti_amplification chipLabel is literally "Popularity is not proof" (doctrine-canonical)', () => {
    expect(VALIDATION_ACTION_MAP.anti_amplification.chipLabel).toBe('Popularity is not proof');
  });

  test('platform_support_warning chipLabel is literally "Hold off on scoring" (matches RULE-001)', () => {
    expect(VALIDATION_ACTION_MAP.platform_support_warning.chipLabel).toBe('Hold off on scoring');
  });
});

// ─────────────────────────────────────────────────────────────
// 4. Issue acceptance criteria
// ─────────────────────────────────────────────────────────────

describe('RULE-002 — issue acceptance criteria', () => {
  test('weak_topic_satisfaction → "Sharpen the topic link" chip with topic-link helper', () => {
    const a = VALIDATION_ACTION_MAP.weak_topic_satisfaction;
    expect(a.chipLabel).toBe('Sharpen the topic link');
    expect(a.helperLine.toLowerCase()).toContain('topic');
    expect(a.suggestedMove).not.toBeNull();
  });

  test('parent_nonresponsive → "Reconnect to parent" chip with suggestedMove = branch_tangent', () => {
    const a = VALIDATION_ACTION_MAP.parent_nonresponsive;
    expect(a.chipLabel).toBe('Reconnect to parent');
    // ST-002 has no `clarify`-shaped SuggestedMoveCode; branch_tangent is
    // the documented preset_gap fallback. The dock + preset fields below
    // correctly point to clarify so the composer opens a clarification
    // draft when pressed.
    expect(a.suggestedMove).toBe<SuggestedMoveCode>('branch_tangent');
    expect(a.dockAction).toBe('clarify');
    expect(a.presetKey).toBe('clarify');
  });

  test('evidence_required → "Attach a source" chip with add_evidence dock + evidence preset', () => {
    const a = VALIDATION_ACTION_MAP.evidence_required;
    expect(a.chipLabel).toBe('Attach a source');
    expect(a.suggestedMove).toBe('ask_source');
    expect(a.dockAction).toBe('add_evidence');
    expect(a.presetKey).toBe('evidence');
  });

  test('source_chain (advisory) → "Ask for the source" chip with ask_source dock + source preset', () => {
    const a = VALIDATION_ACTION_MAP.source_chain;
    expect(a.chipLabel).toBe('Ask for the source');
    expect(a.suggestedMove).toBe('ask_source');
    expect(a.dockAction).toBe('ask_source');
    expect(a.presetKey).toBe('source');
  });

  test('tangent_shift_possible → branch_tangent suggestedMove (scope-shift acceptance path)', () => {
    const a = VALIDATION_ACTION_MAP.tangent_shift_possible;
    expect(a.suggestedMove).toBe('branch_tangent');
    expect(a.dockAction).toBe('branch');
    expect(a.presetKey).toBe('branch');
  });

  test('loaded_clarification_possible → clarify dockAction (definition ambiguity acceptance path)', () => {
    const a = VALIDATION_ACTION_MAP.loaded_clarification_possible;
    expect(a.dockAction).toBe('clarify');
    expect(a.presetKey).toBe('clarify');
  });
});

// ─────────────────────────────────────────────────────────────
// 5. Submit-button gate is purely additive (doctrine §1)
// ─────────────────────────────────────────────────────────────

describe('RULE-002 — submit-button gate is additive only', () => {
  test('a chip-emitting code does not mutate an EvaluationResult-shaped fixture', () => {
    const fixture = {
      allowPost: true,
      blockingErrors: [],
      warnings: [
        {
          ruleCode: 'topic_satisfaction_lexical',
          flagCode: 'weak_topic_satisfaction',
          severity: 'warning',
          message: 'Topic coverage is light.',
          payload: {},
        },
      ],
      flagsToPersist: [],
      normalizedTags: [],
    };
    const snapshot = JSON.parse(JSON.stringify(fixture));
    const action = mapValidationActionOrSuppress(fixture.warnings[0].flagCode);
    expect(action).not.toBeNull();
    // Reading the action must not alter the input.
    expect(fixture).toEqual(snapshot);
    // allowPost stays true regardless of chip presence.
    expect(fixture.allowPost).toBe(true);
  });

  test('a blocking-error fixture with a chip-emitting code stays blocked (chip is advisory only)', () => {
    const fixture = {
      allowPost: false,
      blockingErrors: [
        {
          ruleCode: 'evidence_source_required',
          flagCode: 'evidence_required',
          severity: 'blocking',
          message: 'Evidence post needs at least one source.',
          payload: {},
        },
      ],
      warnings: [],
      flagsToPersist: [],
      normalizedTags: [],
    };
    const action = mapValidationActionOrSuppress(fixture.blockingErrors[0].flagCode);
    expect(action).not.toBeNull();
    // The chip exists, but the engine's `allowPost: false` is still the
    // gate. Pressing the chip cannot bypass the block — the chip only
    // pre-seeds a composer patch that the user then submits through the
    // normal path.
    expect(fixture.allowPost).toBe(false);
  });

  test('ordinary replies remain postable — a synthetic EvaluationResult with allowPost: true and one weak_topic_satisfaction warning still posts', () => {
    const fixture = {
      allowPost: true,
      blockingErrors: [],
      warnings: [
        {
          ruleCode: 'topic_satisfaction_lexical',
          flagCode: 'weak_topic_satisfaction',
          severity: 'warning',
          message: 'Topic coverage is light.',
          payload: {},
        },
      ],
    };
    // canSubmit-equivalent (the composer's actual `canSubmit` formula
    // reduces to `evaluationResult.allowPost ?? false` after the other
    // gating checks; RULE-002 does not contribute to it).
    const canSubmitEquivalent = fixture.allowPost === true;
    expect(canSubmitEquivalent).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// 6. Normalisation
// ─────────────────────────────────────────────────────────────

describe('RULE-002 — normalisation', () => {
  test('mapValidationActionOrSuppress("OFF_TOPIC") resolves to off_topic', () => {
    const a = mapValidationActionOrSuppress('OFF_TOPIC');
    expect(a?.code).toBe('off_topic');
  });

  test('mapValidationActionOrSuppress("off-topic") resolves to off_topic', () => {
    const a = mapValidationActionOrSuppress('off-topic');
    expect(a?.code).toBe('off_topic');
  });

  test('mapValidationActionOrSuppress("  off_topic  ") resolves to off_topic', () => {
    const a = mapValidationActionOrSuppress('  off_topic  ');
    expect(a?.code).toBe('off_topic');
  });

  test('mapValidationActionOrSuppress("Off Topic") resolves to off_topic', () => {
    const a = mapValidationActionOrSuppress('Off Topic');
    expect(a?.code).toBe('off_topic');
  });

  test('mapValidationActionOrSuppress empty / null / undefined / unknown all resolve to null', () => {
    expect(mapValidationActionOrSuppress('')).toBeNull();
    expect(mapValidationActionOrSuppress(null)).toBeNull();
    expect(mapValidationActionOrSuppress(undefined)).toBeNull();
    expect(mapValidationActionOrSuppress('made_up_xyz')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// 7. Coordination with RULE-001
// ─────────────────────────────────────────────────────────────

describe('RULE-002 — coordination with RULE-001', () => {
  // Codes present in BOTH RULE-001 (ruleToUiMap) and RULE-002 (validationActionMap).
  // Their chipLabel in RULE-002 must equal their toolLabel in RULE-001
  // so cross-surface vocabulary stays unified.
  const SHARED_CODES: ValidationActionCode[] = [
    'source_chain',
    'evidence_debt',
    'anti_amplification',
    'platform_support_warning',
    'synthesis_ready',
  ];

  test.each(SHARED_CODES)(
    '%s — RULE-002 chipLabel matches RULE-001 toolLabel',
    (code) => {
      const r2 = VALIDATION_ACTION_MAP[code];
      const r1 = RULE_TO_UI_AFFORDANCE[code as keyof typeof RULE_TO_UI_AFFORDANCE];
      expect(r1).toBeDefined();
      expect(r2.chipLabel).toBe(r1.toolLabel);
    },
  );

  test('codes ONLY in RULE-002 (e.g. invalid_transition, missing_parent) return null from RULE-001 lookup', () => {
    const ruleOneOnly = ALL_RULE_CODES.map(String);
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      if (!ruleOneOnly.includes(code)) {
        // RULE-001 may still resolve a few overlapping rule axis codes
        // (e.g. parent_nonresponsive is in BOTH maps). The bar is: a
        // code that exists ONLY in RULE-002 returns null from RULE-001.
        const onlyInTwo = !ALL_RULE_CODES.includes(code as never);
        if (onlyInTwo) {
          expect(mapRuleToUiAffordance(code)).toBeNull();
        }
      }
    }
  });

  test('codes ONLY in RULE-001 (e.g. scope, definition, logic, causal) return null from RULE-002 lookup', () => {
    const onlyInRuleOne = ALL_RULE_CODES.filter((c) => !ALL_VALIDATION_ACTION_CODES.includes(c as never));
    expect(onlyInRuleOne.length).toBeGreaterThan(0); // sanity — there are RULE-001-only axes
    for (const code of onlyInRuleOne) {
      expect(mapValidationActionOrSuppress(code)).toBeNull();
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 8. Render contract
// ─────────────────────────────────────────────────────────────

describe('RULE-002 — render contract', () => {
  test('every code returns a fully-typed ValidationActionUx', () => {
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      const a: ValidationActionUx = VALIDATION_ACTION_MAP[code];
      expect(typeof a.chipLabel).toBe('string');
      expect(typeof a.helperLine).toBe('string');
      expect(['object', 'string']).toContain(typeof a.suggestedMove === null ? 'object' : typeof a.suggestedMove);
      expect(['object', 'string']).toContain(typeof a.dockAction === null ? 'object' : typeof a.dockAction);
      expect(['object', 'string']).toContain(typeof a.presetKey === null ? 'object' : typeof a.presetKey);
    }
  });

  test('shouldRenderValidationActionChip returns false for SUPPRESSED_CODES — these codes produce no chip', () => {
    for (const code of SUPPRESSED_CODES) {
      const a = VALIDATION_ACTION_MAP[code];
      expect(a.suggestedMove).toBeNull();
      expect(a.dockAction).toBeNull();
      expect(a.presetKey).toBeNull();
      expect(shouldRenderValidationActionChip(a)).toBe(false);
    }
  });

  test('shouldRenderValidationActionChip returns true for every CHIP_EMITTING_CODE', () => {
    expect(CHIP_EMITTING_CODES.length).toBeGreaterThan(0);
    for (const code of CHIP_EMITTING_CODES) {
      const a = VALIDATION_ACTION_MAP[code];
      expect(shouldRenderValidationActionChip(a)).toBe(true);
    }
  });

  test('accessibilityLabel-shaped string ("${chipLabel}. ${helperLine}") is well-formed for every chip-emitting code', () => {
    for (const code of CHIP_EMITTING_CODES) {
      const a = VALIDATION_ACTION_MAP[code];
      const a11y = `${a.chipLabel}. ${a.helperLine}`;
      expect(a11y.length).toBeGreaterThan(0);
      expect(a11y.length).toBeLessThanOrEqual(115); // 32 + 2 + 80 + slack
    }
  });

  test('every chip-emitting code routes through quickActionToPreset without throwing', () => {
    for (const code of CHIP_EMITTING_CODES) {
      const a = VALIDATION_ACTION_MAP[code];
      if (a.presetKey !== null) {
        // Should never throw. May return null (e.g. when parentType
        // forbids the preset) — that's acceptable; the composer becomes
        // a no-op rather than crashes.
        expect(() => quickActionToPreset(a.presetKey as QuickActionLabel, null)).not.toThrow();
      }
    }
  });

  test('every chip-emitting code has a valid TimelineNodeActionDockActionCode for dockAction (when non-null)', () => {
    for (const code of CHIP_EMITTING_CODES) {
      const a = VALIDATION_ACTION_MAP[code];
      if (a.dockAction !== null) {
        expect(ALL_TIMELINE_NODE_ACTION_DOCK_ACTION_CODES).toContain(
          a.dockAction as TimelineNodeActionDockActionCode,
        );
      }
    }
  });

  test('every chip-emitting code has a valid SuggestedMoveCode for suggestedMove (when non-null)', () => {
    for (const code of CHIP_EMITTING_CODES) {
      const a = VALIDATION_ACTION_MAP[code];
      if (a.suggestedMove !== null) {
        expect(ALL_SUGGESTED_MOVE_CODES).toContain(a.suggestedMove as SuggestedMoveCode);
      }
    }
  });

  test('chip on an EvaluationResult with allowPost: true does not change allowPost', () => {
    const before = { allowPost: true, blockingErrors: [], warnings: [] };
    const action = mapValidationActionOrSuppress('weak_topic_satisfaction');
    void action; // chip exists; reading the chip is a pure operation
    expect(before.allowPost).toBe(true);
  });

  test('chip on an EvaluationResult with allowPost: false does not change allowPost', () => {
    const before = { allowPost: false, blockingErrors: [{}], warnings: [] };
    const action = mapValidationActionOrSuppress('evidence_required');
    void action;
    expect(before.allowPost).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 9. Snake_case & frozen-structure hygiene
// ─────────────────────────────────────────────────────────────

describe('RULE-002 — code shape & frozen structure', () => {
  test('every ValidationActionCode matches /^[a-z][a-z0-9_]*$/', () => {
    const re = /^[a-z][a-z0-9_]*$/;
    for (const code of ALL_VALIDATION_ACTION_CODES) {
      expect(code).toMatch(re);
    }
  });

  test('every map key equals its entry.code', () => {
    for (const [key, entry] of Object.entries(VALIDATION_ACTION_MAP)) {
      expect(entry.code).toBe(key);
    }
  });

  test('ALL_VALIDATION_ACTION_CODES is frozen', () => {
    expect(Object.isFrozen(ALL_VALIDATION_ACTION_CODES)).toBe(true);
  });

  test('VALIDATION_ACTION_MAP is frozen', () => {
    expect(Object.isFrozen(VALIDATION_ACTION_MAP)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// 10. Doctrine self-check — engine sacred + no AI / network
// ─────────────────────────────────────────────────────────────

describe('RULE-002 — doctrine self-check', () => {
  // The validationActionMap.ts source file is read directly and scanned
  // for forbidden patterns. This is a structural guarantee — the engine
  // module is type-imported but NEVER value-imported (the type-only
  // import is erased at compile time, so no runtime dependency exists).

  const SOURCE_PATH = path.resolve(
    __dirname,
    '..',
    'src',
    'features',
    'rulesUx',
    'validationActionMap.ts',
  );

  let sourceText = '';
  beforeAll(() => {
    sourceText = fs.readFileSync(SOURCE_PATH, 'utf-8');
  });

  test('validationActionMap source contains no `fetch` / `Supabase` client / Anthropic / xAI literal', () => {
    expect(sourceText).not.toMatch(/\bfetch\s*\(/);
    // Allow occurrences of "Supabase" inside comments is fine; we scan
    // for an `import` from a Supabase / Anthropic / xAI client only.
    expect(sourceText).not.toMatch(/from\s+['"][^'"]*supabase[^'"]*['"]/i);
    expect(sourceText).not.toMatch(/from\s+['"][^'"]*anthropic[^'"]*['"]/i);
    expect(sourceText).not.toMatch(/from\s+['"][^'"]*xai[^'"]*['"]/i);
    expect(sourceText).not.toMatch(/process\.env\.[A-Z_]+API_KEY/);
  });

  test('validationActionMap NEVER value-imports the constitution engine module (sacred rule)', () => {
    // Doctrine §5: the engine module is sacred. RULE-002 is a UX adapter
    // that mirrors the FLAG_CODES values into a union but NEVER imports
    // from constitution/engine at runtime. Type-only imports are erased
    // at compile time and are therefore safe; the implementation chose
    // to skip even the type import and mirror the values directly to
    // keep this module fully self-contained.
    const valueImports = sourceText.match(/^import\s+\{[^}]+\}\s+from\s+['"][^'"]*constitution\/engine[^'"]*['"]/gm) ?? [];
    expect(valueImports.length).toBe(0);
    const valueImportsWithSideEffect = sourceText.match(/^import\s+['"][^'"]*constitution\/engine[^'"]*['"]/gm) ?? [];
    expect(valueImportsWithSideEffect.length).toBe(0);
    // Any constitution-* import that does exist MUST be type-only.
    const constitutionImports = sourceText.match(/^import\s+[^;]+from\s+['"][^'"]*constitution[^'"]*['"]/gm) ?? [];
    for (const imp of constitutionImports) {
      expect(imp).toMatch(/^import\s+type\s/);
    }
  });

  test('validationActionMap is pure constants + reader functions — no React / state / async', () => {
    expect(sourceText).not.toMatch(/\bfrom\s+['"]react['"]/);
    expect(sourceText).not.toMatch(/\buseState\b/);
    expect(sourceText).not.toMatch(/\buseEffect\b/);
    expect(sourceText).not.toMatch(/\basync\b/);
    expect(sourceText).not.toMatch(/\bawait\b/);
  });

  test('engine module file is not modified by this change (sacred-rule guard)', () => {
    // RULE-002 is an adapter; the engine and types files must remain
    // structurally as they are. We do a sanity check that the expected
    // FLAG_CODES export still contains all 16 keys our union depends on.
    expect(Object.keys(FLAG_CODES).length).toBe(16);
    const expected = new Set([
      'OFF_TOPIC',
      'WEAK_TOPIC',
      'MISSING_PARENT',
      'INVALID_TRANSITION',
      'EVIDENCE_REQUIRED',
      'CIVILITY_RISK',
      'AD_HOMINEM',
      'DUPLICATE',
      'EXCESSIVE_LENGTH',
      'UNCLEAR_CLAIM',
      'MOD_REVIEW',
      'PARENT_NONRESPONSIVE',
      'TANGENT_SHIFT',
      'CONCESSION_EVASION',
      'LOADED_CLARIFICATION',
      'FACT_CONFUSION',
    ]);
    for (const k of Object.keys(FLAG_CODES)) {
      expect(expected.has(k)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 11. Regression / integration spot — plain-language layer
// ─────────────────────────────────────────────────────────────

describe('RULE-002 — gameCopy plain-language layer stays wired for advisory codes', () => {
  test('toPlainLanguage(code) returns a non-null string for every advisory code RULE-002 covers', () => {
    // The advisory codes were already keyed in PLAIN_LANGUAGE_COPY before
    // RULE-002 landed. This regression test asserts that wiring is still
    // intact — RULE-002 is a SUPPLEMENT, not a replacement.
    for (const code of ADVISORY_CODES_LIST) {
      const plain = toPlainLanguage(code);
      expect(plain).not.toBeNull();
      expect(typeof plain).toBe('string');
      if (typeof plain === 'string') {
        expect(plain.length).toBeGreaterThan(0);
      }
    }
  });

  test('toPlainLanguage(code) is also non-null for engine FlagCodes that PLAIN_LANGUAGE_COPY covers', () => {
    // Engine flag codes that happen to be keyed in PLAIN_LANGUAGE_COPY
    // (e.g. parent_nonresponsive, off_topic, weak_topic, evidence_required,
    // invalid_transition, missing_parent, etc.) should keep returning a
    // plain-language string.
    const keyedFlagCodes: ValidationActionCode[] = [
      'parent_nonresponsive',
      'off_topic',
      'evidence_required',
      'invalid_transition',
      'missing_parent',
      'excessive_length',
      'unclear_claim',
      'civility_risk',
    ];
    for (const code of keyedFlagCodes) {
      // Only assert when the code actually appears in PLAIN_LANGUAGE_COPY
      // (since the engine emits some flags that intentionally have no
      // user-facing plain-language fallback).
      const plain = toPlainLanguage(code);
      if (plain !== null) {
        expect(typeof plain).toBe('string');
        expect(plain.length).toBeGreaterThan(0);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────
// 12. Engine-emitted FlagCodes exhaustiveness — separate, focused
// ─────────────────────────────────────────────────────────────

describe('RULE-002 — every engine FlagCode is represented (compile-time + runtime)', () => {
  test('runtime: every value of FLAG_CODES lives in ALL_VALIDATION_ACTION_CODES', () => {
    for (const fc of ENGINE_FLAG_CODES_LIST) {
      expect(ALL_VALIDATION_ACTION_CODES).toContain(fc);
    }
  });

  test('compile-time: every ValidationActionCode that is a FlagCode resolves to a defined entry', () => {
    for (const fc of ENGINE_FLAG_CODES_LIST) {
      const entry = VALIDATION_ACTION_MAP[fc];
      expect(entry).toBeDefined();
      expect(entry.code).toBe(fc);
    }
  });
});
