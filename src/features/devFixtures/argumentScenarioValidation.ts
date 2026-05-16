import type { FixtureScenario, FixtureMove } from './argumentScenarioTypes';

export const FORBIDDEN_TERMS: string[] = [
  'bad faith',
  'manipulation',
  'liar',
  'dishonest',
  'winner',
  'truth',
  'ban',
  'hide',
];

// Pre-compiled word-boundary regexes for each forbidden term.
// \b prevents false positives like "ban" in "urban" or "hide" in "hideaway".
const FORBIDDEN_TERM_RES: RegExp[] = FORBIDDEN_TERMS.map((term) => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i');
});

// Patterns that must never appear in fixture content (secrets, tokens, credentials).
const SECRET_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9]{20,}/,
  /SUPABASE_SERVICE_ROLE/i,
  /eyJ[a-zA-Z0-9_-]{20,}/,
  /[a-f0-9]{32,}\.[a-f0-9]{20,}/i,
];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PASSWORD_RE = /\bpassword\b/i;

function scanText(text: string, label: string): string[] {
  if (!text) return [];
  const errs: string[] = [];
  for (let i = 0; i < FORBIDDEN_TERMS.length; i++) {
    if (FORBIDDEN_TERM_RES[i].test(text)) {
      errs.push(`Forbidden term "${FORBIDDEN_TERMS[i]}" in ${label}: "${text.slice(0, 60)}"`);
    }
  }
  for (const re of SECRET_PATTERNS) {
    if (re.test(text)) {
      errs.push(`Possible secret pattern in ${label}: "${text.slice(0, 60)}"`);
    }
  }
  if (EMAIL_RE.test(text)) {
    errs.push(`Email address in ${label}: "${text.slice(0, 60)}"`);
  }
  if (PASSWORD_RE.test(text)) {
    errs.push(`"password" keyword in ${label}: "${text.slice(0, 60)}"`);
  }
  return errs;
}

export function validateScenario(scenario: FixtureScenario): string[] {
  const errors: string[] = [];

  if (!scenario.scenarioId) errors.push('Missing scenarioId');
  if (!scenario.title) errors.push('Missing title');
  if (!scenario.resolution) errors.push('Missing resolution');
  if (!scenario.category) errors.push('Missing category');
  if (!scenario.personas?.length) errors.push('No personas defined');
  if (!scenario.moves?.length) { errors.push('No moves defined'); return errors; }

  if (scenario.moves.length < 6) errors.push(`Too few moves: ${scenario.moves.length} (minimum 6)`);
  if (scenario.moves.length > 10) errors.push(`Too many moves: ${scenario.moves.length} (maximum 10)`);

  // Unique move IDs
  const ids = scenario.moves.map((m) => m.moveId);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    errors.push(`Duplicate move IDs: ${dupes.join(', ')}`);
  }

  const moveMap = new Map<string, FixtureMove>(scenario.moves.map((m) => [m.moveId, m]));

  // Parent references exist
  for (const move of scenario.moves) {
    if (move.parentMoveId !== null && move.parentMoveId !== undefined) {
      if (!moveMap.has(move.parentMoveId)) {
        errors.push(`Move "${move.moveId}" references non-existent parent "${move.parentMoveId}"`);
      }
    }
  }

  // At least one root move
  const roots = scenario.moves.filter((m) => m.parentMoveId === null);
  if (roots.length === 0) errors.push('No root move (parentMoveId must be null on exactly one move)');

  // Challenge moves must have axis or qualifier
  for (const move of scenario.moves) {
    if (move.moveKind === 'challenge_parent') {
      if (!move.disagreementAxis && !move.qualifierCode) {
        errors.push(`Challenge move "${move.moveId}" needs disagreementAxis or qualifierCode`);
      }
    }
  }

  // Required move kinds
  const kinds = new Set(scenario.moves.map((m) => m.moveKind));
  const required: Array<FixtureMove['moveKind']> = [
    'challenge_parent',
    'ask_clarification',
    'add_evidence',
    'concede_or_narrow',
    'synthesize_thread',
  ];
  for (const kind of required) {
    if (!kinds.has(kind)) errors.push(`Missing required move kind: "${kind}"`);
  }

  // At least one quote anchor candidate
  const hasAnchor = scenario.moves.some(
    (m) => (m.targetExcerpt?.length ?? 0) > 0 || (m.displayMeta?.quoteAnchorCandidate?.length ?? 0) > 0,
  );
  if (!hasAnchor) errors.push('No quote anchor candidate (targetExcerpt or displayMeta.quoteAnchorCandidate)');

  // At least one playful label
  const hasPlayful = scenario.moves.some(
    (m) => (m.displayMeta?.playfulLabel?.length ?? 0) > 0,
  );
  if (!hasPlayful) errors.push('No playful concession label in displayMeta');

  // Target excerpts must appear verbatim in the parent body
  for (const move of scenario.moves) {
    if (move.targetExcerpt && move.parentMoveId) {
      const parent = moveMap.get(move.parentMoveId);
      if (parent && !parent.body.includes(move.targetExcerpt)) {
        errors.push(
          `Move "${move.moveId}" targetExcerpt not found in parent "${move.parentMoveId}" body: "${move.targetExcerpt.slice(0, 50)}"`,
        );
      }
    }
  }

  // Content safety scan
  errors.push(...scanText(scenario.title, 'title'));
  errors.push(...scanText(scenario.resolution, 'resolution'));
  errors.push(...scanText(scenario.notes ?? '', 'notes'));
  for (const move of scenario.moves) {
    const label = `move[${move.moveId}]`;
    errors.push(...scanText(move.body, `${label}.body`));
    errors.push(...scanText(move.targetExcerpt ?? '', `${label}.targetExcerpt`));
    errors.push(...scanText(move.displayMeta?.playfulLabel ?? '', `${label}.displayMeta.playfulLabel`));
    errors.push(...scanText(move.evidence?.sourceText ?? '', `${label}.evidence.sourceText`));
    errors.push(...scanText(move.evidence?.label ?? '', `${label}.evidence.label`));
    errors.push(...scanText(move.evidence?.url ?? '', `${label}.evidence.url`));
  }
  for (const persona of scenario.personas) {
    errors.push(...scanText(persona.alias, 'persona.alias'));
  }

  return errors;
}

export function isValidScenario(scenario: unknown): boolean {
  if (typeof scenario !== 'object' || scenario === null) return false;
  return validateScenario(scenario as FixtureScenario).length === 0;
}
