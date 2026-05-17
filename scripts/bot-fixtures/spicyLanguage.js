/**
 * Bounded "spicy" language pools for stress-test bot moves.
 *
 * Rule: attack the move, not the person. Bots may sound sharp, sarcastic,
 * skeptical, and annoying about claims. Bots must NEVER make protected-class
 * attacks, threats, doxxing, sexual remarks, real-person accusations, or label
 * a counterpart a liar / dishonest / bad faith / manipulator / winner / loser.
 *
 * Pure / CommonJS so tests can require() it without side effects.
 */

const PROVOCATEUR_OPENERS = [
  "I'm planting the flag.",
  "Hot take incoming.",
  "Tee-up for the obvious counter:",
  "I know this is going to get challenged, and that's the point.",
  "This claim is spicy but testable.",
];

const OBVIOUS_COUNTER_TEEUPS = [
  "The obvious objection is that",
  "I know someone will say",
  "Counter-claim tee-up:",
  "The predictable pushback:",
];

const REVOCATEUR_CHALLENGES = [
  "That sounds like a dodge.",
  "That's a vibes-only claim.",
  "This is doing a lot of work.",
  "You are smuggling in the conclusion.",
  "That example cannot carry the whole argument.",
  "Wrong scope.",
  "Define that first.",
  "This claim needs a leash.",
  "That is a bold claim wearing a tiny hat.",
  "The receipt drawer is empty.",
];

const QUOTE_DEMANDS = [
  "Quote the exact bit.",
  "Which part exactly?",
  "Point to the sentence.",
  "Show me the words.",
];

const RECEIPT_DEMANDS = [
  "Receipts, please.",
  "Receipts or it did not happen.",
  "Where is this from?",
  "Source check.",
  "Bring the receipts.",
];

const SCOPE_CHALLENGES = [
  "Wrong scope.",
  "That is broader than the original claim.",
  "You moved the goalposts.",
  "Scope creep.",
  "Narrow that down.",
];

const DEFINITION_CHALLENGES = [
  "Define that first.",
  "What do you mean by that exactly?",
  "That word is doing a lot of work.",
  "Pin the definition.",
];

const TANGENT_HOOKS = [
  "This tangent wants its own room.",
  "That deserves its own thread.",
  "Branch candidate: own room.",
  "Side quest. New thread.",
];

const CONCESSION_PHRASES = [
  "I grant",
  "I acknowledge",
  "I concede",
  "Fair point",
  "I agree with",
];

const CONCESSION_NARROWERS = [
  "I will surrender the small point, not the whole war.",
  "I am only mostly wrong about this.",
  "Mostly wrong, partly right.",
  "Peace treaty-ish on this narrow point.",
  "Argument got smaller.",
];

const SYNTHESIS_PHRASES = [
  "I acknowledge both sides agreed",
  "I grant the room has converged",
  "I acknowledge the open question is",
];

// Words and phrases that must NEVER appear in generated bot bodies.
// Tests assert absence. Pre-compiled with word-boundary regexes.
const FORBIDDEN_PHRASES = [
  'you are stupid',
  'you are dumb',
  'you are an idiot',
  'you are a moron',
  'you are a fool',
  'you are lying',
  'you are dishonest',
  'you are a liar',
  'bad faith',
  'manipulative',
  'manipulation',
  'liar',
  'dishonest',
  // System-level verdict words that bots must not declare
  'winner',
  'loser',
];

module.exports = {
  PROVOCATEUR_OPENERS,
  OBVIOUS_COUNTER_TEEUPS,
  REVOCATEUR_CHALLENGES,
  QUOTE_DEMANDS,
  RECEIPT_DEMANDS,
  SCOPE_CHALLENGES,
  DEFINITION_CHALLENGES,
  TANGENT_HOOKS,
  CONCESSION_PHRASES,
  CONCESSION_NARROWERS,
  SYNTHESIS_PHRASES,
  FORBIDDEN_PHRASES,
};
