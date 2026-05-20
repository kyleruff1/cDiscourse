/**
 * PR-002 — The closed, curated profile-tag vocabulary.
 *
 * Pure TypeScript. This is the COMPLETE v1 tag vocabulary. Users pick
 * from exactly these tags; there is NO free-text entry anywhere in
 * PR-002 and NO "custom / other" escape hatch.
 *
 * Doctrine (the card's DISALLOWED list — doctrine-load-bearing):
 *   A closed vocabulary is the mechanism that makes the DISALLOWED list
 *   enforceable. Every label below is plain-language, identity-light, and
 *   carries:
 *     - NO protected-class targeting,
 *     - NO party affiliation,
 *     - NO unverified "expert" / credential claim,
 *     - NO hostile label,
 *     - NO ideology / personality score.
 *   `profileTagVocabularySafety.test.ts` exhaustively asserts this.
 *
 * The vocabulary is frozen (`Object.freeze`) and is the single source of
 * truth for both the UI and the safety test.
 */

import type { ProfileTagCategory, ProfileTagDefinition } from './profileTagModel';

/** The four tag categories, in the order they render in the popout. */
export const ALL_PROFILE_TAG_CATEGORIES: ReadonlyArray<ProfileTagCategory> =
  Object.freeze(['topic_interest', 'debate_style', 'availability', 'accessibility_note']);

/**
 * Category 1 — Topic interests (10 tags). Broad subject areas,
 * deliberately neutral. No hot-button single-issue tags (those invite
 * party-affiliation signalling and protected-class proximity).
 *
 * Category 2 — Debate style (8 tags). How the person likes to engage —
 * process descriptors, never personality verdicts.
 *
 * Category 3 — Availability (5 tags). Coarse scheduling context only —
 * no precise time-zone tags (a timezone can proxy a location).
 *
 * Category 4 — Accessibility self-description (5 tags). Optional,
 * self-described notes so other people can be considerate. These are
 * NOT functional settings (PR-001 owns `reduceMotion` / `colorMode`);
 * they are inert social context and drive nothing in the renderer. Each
 * tag describes a PRACTICE or PREFERENCE the user chooses to share —
 * never a diagnosis, disability category, or clinical/identity label.
 */
export const PROFILE_TAG_VOCABULARY: ReadonlyArray<ProfileTagDefinition> = Object.freeze([
  // ── Category 1 — Topic interests ──────────────────────────────
  { id: 'topic_climate', category: 'topic_interest', label: 'Climate & environment' },
  { id: 'topic_technology', category: 'topic_interest', label: 'Technology & internet' },
  { id: 'topic_science', category: 'topic_interest', label: 'Science & research' },
  { id: 'topic_economy', category: 'topic_interest', label: 'Economy & work' },
  { id: 'topic_education', category: 'topic_interest', label: 'Education & learning' },
  { id: 'topic_health', category: 'topic_interest', label: 'Health & wellbeing' },
  { id: 'topic_culture', category: 'topic_interest', label: 'Arts & culture' },
  { id: 'topic_history', category: 'topic_interest', label: 'History' },
  { id: 'topic_cities', category: 'topic_interest', label: 'Cities & transport' },
  { id: 'topic_ethics', category: 'topic_interest', label: 'Ethics & philosophy' },

  // ── Category 2 — Debate style ─────────────────────────────────
  { id: 'style_evidence_first', category: 'debate_style', label: 'Likes evidence-first arguments' },
  { id: 'style_steelman', category: 'debate_style', label: 'Enjoys steelmanning' },
  { id: 'style_concise', category: 'debate_style', label: 'Prefers concise points' },
  { id: 'style_deep_dive', category: 'debate_style', label: 'Enjoys deep dives' },
  { id: 'style_questions', category: 'debate_style', label: 'Asks lots of questions' },
  { id: 'style_definitions', category: 'debate_style', label: 'Likes pinning down definitions' },
  { id: 'style_friendly', category: 'debate_style', label: 'Keeps it friendly' },
  { id: 'style_learning', category: 'debate_style', label: 'Here mostly to learn' },

  // ── Category 3 — Availability ─────────────────────────────────
  { id: 'avail_weekdays', category: 'availability', label: 'Usually around on weekdays' },
  { id: 'avail_weekends', category: 'availability', label: 'Usually around on weekends' },
  { id: 'avail_evenings', category: 'availability', label: 'Usually around in the evenings' },
  { id: 'avail_async', category: 'availability', label: 'Replies when I can (no rush)' },
  { id: 'avail_quick', category: 'availability', label: 'Happy to reply quickly' },

  // ── Category 4 — Accessibility self-description ────────────────
  { id: 'a11y_screen_reader', category: 'accessibility_note', label: 'I use a screen reader' },
  { id: 'a11y_plain_language', category: 'accessibility_note', label: 'I prefer plain language' },
  { id: 'a11y_short_messages', category: 'accessibility_note', label: 'Shorter messages help me' },
  { id: 'a11y_more_time', category: 'accessibility_note', label: 'I may need more time to reply' },
  { id: 'a11y_captions', category: 'accessibility_note', label: 'I prefer text over audio/video' },
]);
