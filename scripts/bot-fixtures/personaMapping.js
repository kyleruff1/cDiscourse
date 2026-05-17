/**
 * Maps a fixture persona's debate-stance side ('affirmative' | 'negative' |
 * 'neutral') to the participant `side` the bot should hold in
 * `debate_participants`.
 *
 * Why: 'neutral' personas (e.g. a third-party synthesizer) cannot post
 * synthesis as a plain 'observer' — `submit-argument`'s authorization matrix
 * only lets observers post neutral clarification_request. A 'neutral' persona
 * therefore takes the 'moderator' participant role, which is allowed to post
 * across argument types per the constitution.
 *
 * Pure / CommonJS so it can be required by tests.
 */
function mapPersonaSideToParticipantSide(personaSide) {
  if (personaSide === 'affirmative' || personaSide === 'negative') return personaSide;
  if (personaSide === 'neutral') return 'moderator';
  return 'observer';
}

module.exports = { mapPersonaSideToParticipantSide };
