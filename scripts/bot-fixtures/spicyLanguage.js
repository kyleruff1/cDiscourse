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
  "Bold claim, fully load-bearing:",
  "Receipts may be incoming.",
  "I'll defend this with my whole chest:",
  "Putting this on the record:",
  "Spicy but defensible:",
];

const OBVIOUS_COUNTER_TEEUPS = [
  "The obvious objection is that",
  "I know someone will say",
  "Counter-claim tee-up:",
  "The predictable pushback:",
  "The lazy rebuttal will be:",
  "The first-page comeback is:",
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
  "Counterexample time.",
  "That premise is doing all the work here.",
  "Where is the rest of this argument?",
  "Polished framing, thin support.",
];

const QUOTE_DEMANDS = [
  "Quote the exact bit.",
  "Which part exactly?",
  "Point to the sentence.",
  "Show me the words.",
  "Which line are you actually defending?",
  "Pull the receipt sentence.",
];

const RECEIPT_DEMANDS = [
  "Receipts, please.",
  "Receipts or it did not happen.",
  "Where is this from?",
  "Source check.",
  "Bring the receipts.",
  "Cite or fold.",
  "Where's the receipt for that?",
];

const SCOPE_CHALLENGES = [
  "Wrong scope.",
  "That is broader than the original claim.",
  "You moved the goalposts.",
  "Scope creep.",
  "Narrow that down.",
  "This claim quietly expanded.",
];

const DEFINITION_CHALLENGES = [
  "Define that first.",
  "What do you mean by that exactly?",
  "That word is doing a lot of work.",
  "Pin the definition.",
  "Definitions, then we talk.",
];

const TANGENT_HOOKS = [
  "This tangent wants its own room.",
  "That deserves its own thread.",
  "Branch candidate: own room.",
  "Side quest. New thread.",
  "Park that — own room.",
];

const COUNTEREXAMPLE_LINES = [
  "Counterexample time.",
  "Here's the case your claim can't carry.",
  "Try this example on for size.",
  "The case that doesn't fit:",
];

const WEAK_EXAMPLE_LINES = [
  "That example is doing most of the lifting.",
  "One example does not make the rule.",
  "That case is the only one that fits.",
  "Sample size of one.",
];

const DODGE_CALLOUT_LINES = [
  "That sounds like a dodge.",
  "Soft-pedal noted.",
  "That answer didn't actually engage the quote.",
  "Smooth deflection, no contact.",
];

const PLAYFUL_SELF_OWN_LINES = [
  "I am only mostly wrong about this.",
  "I'll surrender the small point, not the whole war.",
  "Mostly wrong, partly right.",
  "Peace treaty-ish on this narrow point.",
  "Argument got smaller.",
  "Context goblin defeated.",
];

const CONCESSION_PHRASES = [
  "I grant",
  "I acknowledge",
  "I concede",
  "Fair point",
  "I agree with",
];

const CONCESSION_NARROWERS = PLAYFUL_SELF_OWN_LINES;

const SYNTHESIS_PHRASES = [
  "I acknowledge both sides agreed",
  "I grant the room has converged",
  "I acknowledge the open question is",
  "I acknowledge the room settled, narrowly, on",
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
  COUNTEREXAMPLE_LINES,
  WEAK_EXAMPLE_LINES,
  DODGE_CALLOUT_LINES,
  PLAYFUL_SELF_OWN_LINES,
  CONCESSION_PHRASES,
  CONCESSION_NARROWERS,
  SYNTHESIS_PHRASES,
  FORBIDDEN_PHRASES,
};
