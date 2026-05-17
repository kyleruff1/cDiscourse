/**
 * Stage 6.1.9 — Deterministic dissent detector.
 *
 * For a (source, reply) pair, produces the full Stage 6.1.9 classification
 * shape (agreement / disagreement / coexistence / uncertainty / stance /
 * axis / function / dissent strength / source-chain risk / abuse risk /
 * evidentiary risk / amplification risk / political frame / valence /
 * platformSupportWarning / usableForBotDebate / reason).
 *
 * Pure CommonJS. No network. No AI. Wraps the existing deterministic
 * scalar + mixed-agreement taxonomy from Stage 6.1.3.x.
 *
 * Authorship is not inferred. People are not classified. Only text
 * behavior is annotated.
 */
const { computeAgreementDisagreementVector } = require('./agreementScalarJs');
const { classifyMixedAgreement } = require('./mixedAgreementTaxonomyJs');
const { classifyAbuseRisk, redactRaw } = require('./xaiSourceRedactor');

const MIN_DISSENT_SCORE = 0.30;

const ASK_SOURCE_LEXEMES = [
  'source', 'receipt', 'receipts', 'citation', 'cite', 'where is this from',
  'prove it', 'link?', 'show your work',
  'audit', 'page', 'report', 'study',
  'quote the page', "what's the source",
];
const ASK_QUOTE_LEXEMES = [
  'quote the exact', 'point to the sentence', 'exact words',
  'which part exactly', 'highlight the bit', 'quote it',
  'quote the line', 'quote the section', 'quote the specific',
];
const ASK_DEFINITION_LEXEMES = ['define', 'definition', 'what counts as', 'what do you mean', 'what is your definition'];
const COUNTEREXAMPLE_LEXEMES = ['counterexample', 'counter-example', 'one example', 'edge case', 'what about'];
const TANGENT_LEXEMES = ['speaking of', 'unrelated', 'tangent', 'side note', 'off topic'];
const JOKE_LEXEMES = ['lol', 'lmao', 'rofl', 'haha', 'just kidding', '/s', '😂', '🤣'];

const AMPLIFICATION_LEXEMES = [
  'going viral', 'this is viral', 'huge if true', 'breaking the algorithm',
  'everyone knows', 'the whole timeline', 'nobody is talking about', 'millions are saying',
  'wake up', 'do your research', 'follow the money', 'open your eyes',
];
const OUTRAGE_LEXEMES = ['outrageous', 'unbelievable', 'shocking', 'disgusting', 'insane', 'wild'];
const ALLEGATION_LEXEMES = ['secretly', 'they admitted', 'leaked', 'caught on tape', 'on the record'];
const POLITICAL_FRAME_LEXEMES = {
  election_process: ['ballot', 'voter', 'election', 'voting', 'precinct', 'recount', 'audit the vote'],
  governance: ['congress', 'senate', 'governor', 'legislator', 'bill', 'statute', 'regulation'],
  foreign_policy: ['nato', 'sanctions', 'foreign', 'tariff', 'treaty', 'embassy', 'allies', 'border'],
  economic_policy: ['inflation', 'taxes', 'gdp', 'unemployment', 'wages', 'deficit'],
  civil_rights: ['discrimination', 'civil rights', 'free speech', 'due process'],
  public_safety: ['crime', 'police', 'safety', 'enforcement', 'shooting', 'arrest'],
  institutional_trust: ['establishment', 'corrupt', 'rigged', 'cover-up', 'coverup', 'whistleblower'],
  culture_war: ['woke', 'cancel', 'pronouns', 'dei', 'critical race', 'parental rights'],
  climate_energy: ['climate', 'carbon', 'emissions', 'renewable', 'fossil fuel', 'pipeline'],
  health_policy: ['healthcare', 'vaccine', 'cdc', 'fda', 'medicaid', 'medicare'],
  labor_business: ['union', 'strike', 'corporate', 'minimum wage'],
  technology_platforms: ['algorithm', 'shadowban', 'censorship', 'platform', 'big tech'],
};

function hasAnyLower(text, list) {
  const lc = String(text || '').toLowerCase();
  return list.some((w) => lc.includes(w));
}

function derivePoliticalIssueFrame(text) {
  for (const [frame, lexemes] of Object.entries(POLITICAL_FRAME_LEXEMES)) {
    if (hasAnyLower(text, lexemes)) return frame;
  }
  return String(text || '').length > 40 ? 'non_political' : 'unclear';
}

function deriveSourceChainRisk({ replyText, isAmplification, hasEvidence }) {
  if (hasEvidence) return 'low';
  if (hasAnyLower(replyText, ASK_SOURCE_LEXEMES) || hasAnyLower(replyText, ASK_QUOTE_LEXEMES)) {
    return 'medium'; // the reply is *demanding* source-chain — text shows awareness
  }
  if (isAmplification || hasAnyLower(replyText, ALLEGATION_LEXEMES)) return 'high';
  return 'unknown';
}

function deriveAmplificationRisk({ replyText, isAmplification, isOutrage }) {
  if (isAmplification && isOutrage) return 'high';
  if (isAmplification) return 'medium';
  if (isOutrage) return 'low';
  return 'none_observed';
}

function deriveEvidentiaryRisk({ replyText, hasEvidence, isAmplification }) {
  if (hasEvidence) return 'low';
  if (isAmplification) return 'high';
  if (hasAnyLower(replyText, ALLEGATION_LEXEMES)) return 'high';
  if (String(replyText || '').length < 30) return 'unknown';
  return 'medium';
}

function deriveReplyFunction({ vector, replyText, abuseLevel }) {
  if (abuseLevel === 'high') return 'insult_only';
  if (hasAnyLower(replyText, JOKE_LEXEMES)) return 'tangent';
  if (hasAnyLower(replyText, TANGENT_LEXEMES)) return 'tangent';
  // Order matters: "quote the X" beats "source/page/audit" when both
  // appear in the same reply, because "quote the …" is the most explicit
  // ask-quote signal a human can give.
  if (hasAnyLower(replyText, ASK_QUOTE_LEXEMES)) return 'ask_quote';
  if (hasAnyLower(replyText, ASK_SOURCE_LEXEMES)) return 'ask_source';
  if (hasAnyLower(replyText, ASK_DEFINITION_LEXEMES)) return 'ask_definition';
  if (hasAnyLower(replyText, COUNTEREXAMPLE_LEXEMES)) return 'counterexample';
  if (vector.disagreementType === 'scope') return 'narrow_scope';
  if (vector.disagreementScore >= 0.4) return 'rebut';
  if (vector.agreementScore >= 0.6 && vector.disagreementScore < 0.2) return 'support';
  if (vector.coexistenceScore >= 0.3) return 'caveat';
  return 'unclear';
}

function deriveDisagreementType({ vector, replyText, isAmplification, sourceChainRisk }) {
  if (sourceChainRisk === 'high') return 'source_chain';
  if (isAmplification) return 'anti_amplification';
  return vector.disagreementType || 'none';
}

/**
 * Compute the full Stage 6.1.9 dissent classification for one (source, reply)
 * pair. The reply text is REDACTED first via xaiSourceRedactor so handles +
 * URLs + emails + JWTs are removed before any classification.
 */
function classifyReply({ sourceText, replyText, hasEvidence = false }) {
  const cleanSource = redactRaw(sourceText);
  const cleanReply = redactRaw(replyText);
  const abuse = classifyAbuseRisk(cleanReply);

  const vector = computeAgreementDisagreementVector(cleanSource, cleanReply);
  const flags = classifyMixedAgreement(vector, cleanSource, cleanReply);

  const isAmplification = hasAnyLower(cleanReply, AMPLIFICATION_LEXEMES);
  const isOutrage = hasAnyLower(cleanReply, OUTRAGE_LEXEMES);

  const sourceChainRisk = deriveSourceChainRisk({ replyText: cleanReply, isAmplification, hasEvidence });
  const amplificationRisk = deriveAmplificationRisk({ replyText: cleanReply, isAmplification, isOutrage });
  const evidentiaryRisk = deriveEvidentiaryRisk({ replyText: cleanReply, hasEvidence, isAmplification });
  const replyFunction = deriveReplyFunction({ vector, replyText: cleanReply, abuseLevel: abuse.level });
  const disagreementType = deriveDisagreementType({ vector, replyText: cleanReply, isAmplification, sourceChainRisk });
  const politicalIssueFrame = derivePoliticalIssueFrame(cleanReply);

  // Dissent strength blends scalar disagreement + structural pressure
  // (asks for source/quote/definition/counterexample all count).
  let dissentStrength = vector.disagreementScore;
  if (replyFunction === 'ask_source' || replyFunction === 'ask_quote' || replyFunction === 'ask_definition' || replyFunction === 'counterexample' || replyFunction === 'narrow_scope') {
    dissentStrength = Math.max(dissentStrength, 0.55);
  }
  if (sourceChainRisk === 'high') dissentStrength = Math.max(dissentStrength, 0.6);
  if (isAmplification) dissentStrength = Math.max(dissentStrength, 0.5);
  if (abuse.level === 'high') dissentStrength = 0; // pure abuse is not playable dissent

  // Usable when: meaningful dissent signal AND not pure insult AND there's
  // enough claim content after redaction.
  const hasClaimContent = cleanReply.length >= 40 && /\b(because|so|therefore|prove|source|quote|evidence|axis|scope|definition|cause|reason|narrow|broad|claim|argue|argument)\b/i.test(cleanReply);
  const usableForBotDebate = (
    abuse.level !== 'high'
    && replyFunction !== 'insult_only'
    && replyFunction !== 'tangent'
    && (dissentStrength >= MIN_DISSENT_SCORE
      || replyFunction === 'ask_source'
      || replyFunction === 'ask_quote'
      || replyFunction === 'ask_definition'
      || replyFunction === 'counterexample'
      || replyFunction === 'narrow_scope')
    && hasClaimContent
  );

  const platformSupportWarning = (
    amplificationRisk !== 'none_observed'
    || sourceChainRisk === 'high'
    || evidentiaryRisk === 'high'
  );

  // Build a text-feature-only reason (never references the author).
  const reasonParts = [];
  if (vector.disagreementScore >= 0.35) reasonParts.push(`disagreement scalar ${vector.disagreementScore.toFixed(2)}`);
  if (replyFunction !== 'unclear' && replyFunction !== 'support') reasonParts.push(`reply function=${replyFunction}`);
  if (sourceChainRisk === 'high') reasonParts.push('source-chain risk high');
  if (isAmplification) reasonParts.push('text shows amplification features');
  if (abuse.level !== 'none') reasonParts.push(`abuse-risk text features: ${abuse.categories.join(',')}`);
  if (reasonParts.length === 0) reasonParts.push('no notable dissent text features');

  return {
    agreementScore: vector.agreementScore,
    disagreementScore: vector.disagreementScore,
    coexistenceScore: vector.coexistenceScore,
    uncertaintyScore: vector.uncertaintyScore,
    primaryStance: vector.primaryStance,
    disagreementType,
    agreementType: vector.agreementType,
    replyFunction,
    dissentStrength,
    sourceChainRisk,
    abuseRisk: abuse.level,
    abuseCategories: abuse.categories,
    evidentiaryRisk,
    amplificationRisk,
    politicalIssueFrame,
    politicalValence: 'describes text, not user',
    platformSupportWarning,
    mixedAgreementClass: flags.mixedAgreementClass,
    playableTensionScore: flags.playableTensionScore,
    usableForBotDebate,
    reason: reasonParts.join('; '),
  };
}

/**
 * Pick the FIRST usable dissent reply from an ordered reply list.
 * Returns `{ pick, classification, scanned }` or
 * `{ pick: null, scanned, reason }` if nothing qualifies.
 */
function selectFirstUsableDissent({ sourceText, replies }) {
  if (!Array.isArray(replies) || replies.length === 0) {
    return { pick: null, scanned: 0, classifications: [], reason: 'no_replies' };
  }
  const classifications = [];
  for (let i = 0; i < replies.length; i++) {
    const r = replies[i];
    const replyText = r && (r.replyTextRedacted || r.body || '') || '';
    const c = classifyReply({ sourceText, replyText, hasEvidence: Boolean(r && r.hasEvidence) });
    classifications.push({ reply: r, classification: c });
    if (c.usableForBotDebate) {
      return { pick: { reply: r, classification: c }, scanned: i + 1, classifications, reason: c.reason };
    }
  }
  return { pick: null, scanned: replies.length, classifications, reason: 'no_usable_dissent_found' };
}

module.exports = {
  classifyReply,
  selectFirstUsableDissent,
  MIN_DISSENT_SCORE,
  AMPLIFICATION_LEXEMES,
  ASK_SOURCE_LEXEMES,
  ASK_QUOTE_LEXEMES,
  ASK_DEFINITION_LEXEMES,
  COUNTEREXAMPLE_LEXEMES,
  POLITICAL_FRAME_LEXEMES,
};
