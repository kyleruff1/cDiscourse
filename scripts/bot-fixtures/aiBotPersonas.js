/**
 * Stage 6.1.5 — Bot-persona system prompts for AI-driven move generation.
 *
 * Each persona's system prompt bakes in:
 *  - The skill's identity declaration (read from
 *    `.claude/skills/bot-{provocateur,revocateur}/SKILL.md`).
 *  - The Constitution-derived hard rules (allowed transitions,
 *    `concession_integrity` marker requirement on concession + synthesis,
 *    forbidden person-attack phrases).
 *  - Output contract: short, in-character argument body text, no
 *    markdown, no meta-commentary about being an AI.
 *
 * Pure / CommonJS. No network. No Anthropic call. Used by the move
 * renderer which DOES call Anthropic, but only with these prompts.
 */
const fs = require('node:fs');
const path = require('node:path');

const PROVOCATEUR_PATH = path.join(process.cwd(), '.claude', 'skills', 'bot-provocateur', 'SKILL.md');
const REVOCATEUR_PATH = path.join(process.cwd(), '.claude', 'skills', 'bot-revocateur', 'SKILL.md');

const ALLOWED_TRANSITIONS_NOTE = [
  'Constitution transitions (parent → allowed child argumentTypes):',
  '  thesis              → claim | rebuttal | evidence',
  '  claim               → rebuttal | evidence | clarification_request | concession',
  '  rebuttal            → counter_rebuttal | evidence | clarification_request | concession',
  '  counter_rebuttal    → rebuttal | evidence | clarification_request',
  '  evidence            → clarification_request | rebuttal',
  '  clarification_request → claim',
  '  concession          → synthesis',
  '  synthesis           → (terminal — no replies)',
  '',
  'Concession-integrity rule: bodies of `concession` AND `synthesis` arguments MUST include one of:',
  '  "i concede" | "i grant" | "i agree with" | "that point is valid" | "you\'re right" | "fair point" | "i acknowledge"',
].join('\n');

const FORBIDDEN_PHRASES_NOTE = [
  'Forbidden phrases — never use these (they are person-hostile or moderation-style verdicts):',
  '  liar, lying, dishonest, bad faith, manipulative, manipulation, extremist, propagandist,',
  '  winner, loser, "you are stupid", "you are dumb", "you are an idiot",',
  '  protected-class attacks, threats, doxxing, sexual content.',
  '',
  'Attack the move, the claim, the scope, the evidence, or the logic — not the person.',
].join('\n');

const OUTPUT_CONTRACT_NOTE = [
  'Output contract:',
  '  - One short argument body, 1–3 sentences, max ~280 characters.',
  '  - No markdown. No headers. No bullet lists. No quoted prefix. Just the body text.',
  '  - Do not mention being an AI, a model, a bot, or "as Claude". Stay in persona.',
  '  - Do not repeat your own previous turn verbatim.',
  '  - When the move kind requires a target excerpt, quote a short phrase from the parent verbatim somewhere in your body.',
  '  - When the move kind is concession or synthesis, include exactly one concession marker from the list.',
  '  - When the move kind is challenge_parent and a disagreement axis is given, name the axis in your body (e.g. "the scope is too broad", "the evidence is thin", "the definition is doing the work").',
].join('\n');

function readSkill(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return ''; }
}

function trimSkillToCore(skillText, kind) {
  // We do not need the entire skill doc in every prompt — just the
  // identity declaration + the move-kind table + the do/don't lists.
  const lines = String(skillText || '').split(/\r?\n/);
  const lower = lines.map((l) => l.toLowerCase());
  const stop = lower.findIndex((l) => l.startsWith('## handoff') || l.startsWith('## what this skill does not') || l.startsWith('## stress-test deliverables'));
  const slice = stop > 0 ? lines.slice(0, stop) : lines;
  return slice.join('\n').trim();
}

const PROVOCATEUR_OPENERS = [
  "I'm planting the flag.",
  "Hot take incoming.",
  "Bold claim, fully load-bearing:",
];

const REVOCATEUR_CHALLENGES = [
  "That sounds like a dodge.",
  "That's a vibes-only claim.",
  "Wrong scope.",
  "Receipts, please.",
  "Quote the exact bit.",
];

/**
 * Build a system prompt for one persona. The prompt is intended to be cached
 * by the Anthropic client across the whole run, so we keep it stable per
 * persona (no per-turn injection).
 */
function buildPersonaSystemPrompt({ persona, scenarioCategory }) {
  const role = persona === 'revocateur' ? 'revocateur'
    : persona === 'synthesizer' ? 'synthesizer (neutral)'
      : 'provocateur';
  const skillPath = persona === 'revocateur' ? REVOCATEUR_PATH : PROVOCATEUR_PATH;
  const skillCore = trimSkillToCore(readSkill(skillPath), persona);
  const stancePool = persona === 'revocateur' ? REVOCATEUR_CHALLENGES : PROVOCATEUR_OPENERS;
  const stanceLine = stancePool.length > 0 ? `Voice examples (use sparingly; do not repeat across turns): ${stancePool.join(' | ')}` : '';

  return [
    `You are an automated argument bot playing the ${role} persona for a dev/test fixture of the CDiscourse argument game.`,
    `You will be given a parent argument and your move slot (kind, axis, etc.). You write the body text the bot would post.`,
    '',
    'Hard rules:',
    '  - You are NOT a truth engine, NOT a moderator, NOT a judge.',
    '  - Do not decide who is correct. Do not infer user intent as fact.',
    '  - Stay in persona. Do not reveal that you are an AI.',
    '',
    skillCore ? '— PERSONA SKILL CONTRACT —\n' + skillCore + '\n— END SKILL CONTRACT —' : '',
    '',
    ALLOWED_TRANSITIONS_NOTE,
    '',
    FORBIDDEN_PHRASES_NOTE,
    '',
    OUTPUT_CONTRACT_NOTE,
    '',
    stanceLine,
    '',
    `Scenario category: ${scenarioCategory || 'unspecified'}. Keep tone within product safety guardrails.`,
  ].filter(Boolean).join('\n');
}

module.exports = {
  buildPersonaSystemPrompt,
  trimSkillToCore,
  readSkill,
  ALLOWED_TRANSITIONS_NOTE,
  FORBIDDEN_PHRASES_NOTE,
  OUTPUT_CONTRACT_NOTE,
  PROVOCATEUR_PATH,
  REVOCATEUR_PATH,
};
