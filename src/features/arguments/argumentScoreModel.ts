/**
 * Stage 6.2 — Argument score / trend model (Milestone 6).
 *
 * Pure, deterministic gameplay-analysis scoring. NEVER:
 *   - calls AI;
 *   - calls Supabase;
 *   - labels users (liar / dishonest / extremist / etc.);
 *   - blocks posting;
 *   - persists to any new DB table.
 *
 * Bands shown to users:
 *   - Pretty wrong
 *   - Slightly wrong
 *   - Neutral
 *   - Slightly right
 *   - Maybe right, but misguided
 *   - Pretty right
 *   - Completely right
 *
 * Internal fallback bands:
 *   - Unscored
 *   - Not enough signal
 *
 * Inputs are read from existing message fields: argument type, tags
 * (from `argument_tags`), flags (from `argument_flags`), evidence flag,
 * and topic-satisfaction score. Tone / temperature are derived from
 * civility-related flags + body length.
 */
import {
  inferStandingBand,
  inferToneBand,
  inferTemperatureBand,
  type TimelineStandingBand,
  type TimelineToneBand,
  type TimelineTemperatureBand,
  type ArgumentTimelineMapMessageInput,
  type ArgumentBubbleActor,
} from './argumentGameSurfaceModel';

export type StandingBand = TimelineStandingBand;

// SW-001 — user-facing band labels now come from `standingBandCopy.ts`,
// which uses softened plain-language copy and bans truth/winner tokens.
// Re-exported here as `STANDING_BAND_LABEL` for back-compat with the
// existing call sites in the sidecar and score tracker.
import { STANDING_BAND_SOFT_LABEL } from './standingBandCopy';
export const STANDING_BAND_LABEL: Record<StandingBand, string> = STANDING_BAND_SOFT_LABEL;

const STANDING_BAND_COLOR: Record<StandingBand, string> = {
  pretty_wrong: '#b91c1c',
  slightly_wrong: '#f97316',
  neutral: '#64748b',
  slightly_right: '#22d3ee',
  maybe_right_misguided: '#facc15',
  pretty_right: '#34d399',
  completely_right: '#10b981',
  unscored: '#475569',
  not_enough_signal: '#374151',
};

export interface StatementStanding {
  messageId: string;
  actorId: string | null;
  actorLabel: string;
  standingBand: StandingBand;
  score: number;
  confidence: number;
  toneBand: TimelineToneBand;
  temperatureBand: TimelineTemperatureBand;
  signals: string[];
  warnings: string[];
  color: string;
  accessibilityLabel: string;
}

export interface ParticipantTrend {
  participantId: string;
  participantLabel: string;
  messageCount: number;
  currentBand: StandingBand;
  previousBand: StandingBand;
  trendDirection: 'up' | 'down' | 'flat' | 'unknown';
  averageScore: number;
  averageTone: number;
  averageTemperature: number;
  sparkline: number[];
  lastMoveLabel: string;
  color: string;
}

function bandToScore(band: StandingBand): number {
  switch (band) {
    case 'pretty_wrong': return -1;
    case 'slightly_wrong': return -0.5;
    case 'maybe_right_misguided': return 0.25;
    case 'slightly_right': return 0.5;
    case 'pretty_right': return 0.85;
    case 'completely_right': return 1;
    case 'neutral': return 0;
    default: return 0;
  }
}

function scoreToBand(score: number): StandingBand {
  if (score <= -0.75) return 'pretty_wrong';
  if (score <= -0.25) return 'slightly_wrong';
  if (score < 0.25) return 'neutral';
  if (score < 0.45) return 'slightly_right';
  if (score < 0.7) return 'maybe_right_misguided';
  if (score < 0.92) return 'pretty_right';
  return 'completely_right';
}

function toneNumeric(band: TimelineToneBand): number {
  switch (band) {
    case 'calm': return 0;
    case 'measured': return 0.25;
    case 'heated': return 0.7;
    case 'hostile': return 1;
    default: return 0;
  }
}

function temperatureNumeric(band: TimelineTemperatureBand): number {
  switch (band) {
    case 'cool': return 0;
    case 'mild': return 0.25;
    case 'warm': return 0.7;
    case 'hot': return 1;
    default: return 0;
  }
}

function pickActorLabel(actor: ArgumentBubbleActor): string {
  switch (actor) {
    case 'self': return 'You';
    case 'other': return 'Opponent';
    case 'bot': return 'Bot';
    case 'admin': return 'Admin';
    default: return 'Unknown';
  }
}

function classifyActor(msg: ArgumentTimelineMapMessageInput, currentUserId: string | null): ArgumentBubbleActor {
  if (msg.isBot === true) return 'bot';
  if (!msg.authorId) return 'unknown';
  if (currentUserId && msg.authorId === currentUserId) return 'self';
  return 'other';
}

export interface ComputeStandingInput {
  message: ArgumentTimelineMapMessageInput;
  currentUserId: string | null;
}

export function computeStatementStanding(input: ComputeStandingInput): StatementStanding {
  const { message: m, currentUserId } = input;
  const actor = classifyActor(m, currentUserId);
  const flagCodes = (m.flagCodes || []).map((c) => String(c).toLowerCase());
  const tagCodes = (m.tagCodes || []).map((c) => String(c).toLowerCase());
  const bodyLength = (m.body || '').length;
  const hasEvidence = Boolean(m.hasEvidence);

  const standingBand = m.standingBandOverride || inferStandingBand({
    flagCodes,
    hasEvidence,
    bodyLength,
    topicScore: m.topicScore ?? null,
    tagCodes,
    argumentType: m.argumentType ?? null,
  });
  const toneBand = inferToneBand(flagCodes);
  const temperatureBand = inferTemperatureBand(flagCodes, bodyLength);
  const score = bandToScore(standingBand);

  // Signals + warnings — explainability for the band selection.
  const signals: string[] = [];
  if (m.argumentType === 'evidence' && hasEvidence) signals.push('sourced evidence');
  if (m.argumentType === 'concession' || m.argumentType === 'synthesis') signals.push('narrowing concession');
  if (tagCodes.includes('source_request')) signals.push('asking for source');
  if (tagCodes.includes('quote_request')) signals.push('asking for quote anchor');
  if (typeof m.topicScore === 'number' && m.topicScore > 0.6) signals.push('clearly on topic');

  const warnings: string[] = [];
  if (flagCodes.includes('off_topic')) warnings.push('appears off-topic');
  if (flagCodes.includes('weak_topic')) warnings.push('weak topic coverage');
  if (flagCodes.includes('parent_nonresponsive') || flagCodes.includes('tangent_shift')) warnings.push('low connection to parent');
  if (flagCodes.includes('ad_hominem')) warnings.push('possible personal attack');
  if (flagCodes.includes('civility_risk')) warnings.push('overheated tone');
  if (flagCodes.includes('loaded_clarification')) warnings.push('loaded clarification');
  if (flagCodes.includes('duplicate')) warnings.push('similar to a sibling');
  if (flagCodes.includes('concession_evasion')) warnings.push('possible concession evasion');
  if (flagCodes.includes('evidence_required')) warnings.push('evidence required but missing');

  // Confidence: more signals AND fewer warnings → higher confidence.
  let confidence = 0.3;
  if (signals.length > 0) confidence += 0.2 * Math.min(signals.length, 3);
  if (warnings.length > 0) confidence += 0.15 * Math.min(warnings.length, 3);
  if (flagCodes.length === 0 && signals.length === 0) confidence = 0.1;
  confidence = Math.max(0, Math.min(1, confidence));

  const finalBand: StandingBand = confidence < 0.2 ? 'not_enough_signal' : standingBand;

  const accessibilityLabel = `${STANDING_BAND_LABEL[finalBand]} · tone ${toneBand} · heat ${temperatureBand}`;

  return {
    messageId: m.id,
    actorId: m.authorId,
    actorLabel: pickActorLabel(actor),
    standingBand: finalBand,
    score,
    confidence,
    toneBand,
    temperatureBand,
    signals,
    warnings,
    color: STANDING_BAND_COLOR[finalBand],
    accessibilityLabel,
  };
}

export interface ComputeParticipantTrendsInput {
  messages: ArgumentTimelineMapMessageInput[];
  currentUserId: string | null;
}

export function computeParticipantTrends(input: ComputeParticipantTrendsInput): ParticipantTrend[] {
  const standings = input.messages.map((m) => computeStatementStanding({ message: m, currentUserId: input.currentUserId }));
  const buckets = new Map<string, {
    label: string;
    scores: number[];
    tones: number[];
    temps: number[];
    lastKind: string;
    color: string;
  }>();
  for (let i = 0; i < input.messages.length; i++) {
    const m = input.messages[i];
    const standing = standings[i];
    const pid = m.authorId || `actor-${standing.actorLabel.toLowerCase()}`;
    if (!buckets.has(pid)) {
      buckets.set(pid, { label: standing.actorLabel, scores: [], tones: [], temps: [], lastKind: String(m.argumentType || 'message'), color: standing.color });
    }
    const b = buckets.get(pid)!;
    b.scores.push(bandToScore(standing.standingBand));
    b.tones.push(toneNumeric(standing.toneBand));
    b.temps.push(temperatureNumeric(standing.temperatureBand));
    b.lastKind = String(m.argumentType || 'message');
  }
  const out: ParticipantTrend[] = [];
  for (const [pid, b] of buckets.entries()) {
    const messageCount = b.scores.length;
    const averageScore = messageCount > 0 ? b.scores.reduce((s, v) => s + v, 0) / messageCount : 0;
    const averageTone = messageCount > 0 ? b.tones.reduce((s, v) => s + v, 0) / messageCount : 0;
    const averageTemp = messageCount > 0 ? b.temps.reduce((s, v) => s + v, 0) / messageCount : 0;
    const currentBand = messageCount > 0 ? scoreToBand(b.scores[b.scores.length - 1]) : 'unscored';
    const previousBand = messageCount > 1 ? scoreToBand(b.scores[b.scores.length - 2]) : 'unscored';
    let trendDirection: ParticipantTrend['trendDirection'] = 'unknown';
    if (messageCount >= 2) {
      const cur = b.scores[b.scores.length - 1];
      const prev = b.scores[b.scores.length - 2];
      if (cur > prev + 0.1) trendDirection = 'up';
      else if (cur < prev - 0.1) trendDirection = 'down';
      else trendDirection = 'flat';
    }
    out.push({
      participantId: pid,
      participantLabel: b.label,
      messageCount,
      currentBand,
      previousBand,
      trendDirection,
      averageScore: Math.round(averageScore * 100) / 100,
      averageTone: Math.round(averageTone * 100) / 100,
      averageTemperature: Math.round(averageTemp * 100) / 100,
      sparkline: b.scores.slice(-12),
      lastMoveLabel: b.lastKind,
      color: b.color,
    });
  }
  out.sort((a, b) => a.participantId < b.participantId ? -1 : a.participantId > b.participantId ? 1 : 0);
  return out;
}

export function standingBandColor(band: StandingBand): string {
  return STANDING_BAND_COLOR[band];
}

export function standingBandLabel(band: StandingBand): string {
  return STANDING_BAND_LABEL[band];
}
