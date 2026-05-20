/**
 * PR-002 — Profile tag model (pure TypeScript).
 *
 * No React. No Supabase. No network. No AI. The canonical shape for the
 * device-local profile-tag blob surfaced by the "Profile tags" popout,
 * plus the pure helpers that parse, patch, and resolve it.
 *
 * Doctrine (cdiscourse-doctrine §1/§6/§9/§10, the card's DISALLOWED list):
 *   - A profile tag is cosmetic social context. No value here is ever an
 *     input to the Constitution engine, `argumentScoreModel`,
 *     `antiAmplification`, the point-standing economy, or any validation
 *     gate. A tag never makes a point stronger, weaker, or a post blocked.
 *   - The blob holds only `schemaVersion` + a `string[]` of vocabulary
 *     ids. No token, no secret, no auth material, no `profiles.role`.
 *   - Tags are picked from a CLOSED, curated vocabulary
 *     (`profileTagVocabulary.ts`) — the user never free-texts a tag, so a
 *     hostile label or a protected-class target can never enter the
 *     system. There is no "custom / other" escape hatch.
 *
 * This model deliberately mirrors PR-001's `userPreferencesModel.ts`
 * discipline (versioned blob, defensive `mergeWithDefaults`-style parse,
 * immutable patch helpers) but is a SEPARATE blob — see the design's
 * §Reuse-vs-new decision.
 */

// ── Tag value types ─────────────────────────────────────────────

/** The four allowed tag categories (the card's ALLOWED list). */
export type ProfileTagCategory =
  | 'topic_interest'
  | 'debate_style'
  | 'availability'
  | 'accessibility_note';

/**
 * A single tag in the closed vocabulary. `id` is the stable internal
 * code (never user-visible); `label` is plain-language UI prose;
 * `category` groups it. The vocabulary is CLOSED — users select from
 * `PROFILE_TAG_VOCABULARY`, they never construct a `ProfileTagDefinition`.
 */
export interface ProfileTagDefinition {
  /** Stable internal code, e.g. `topic_climate`. Never rendered to the user. */
  id: string;
  category: ProfileTagCategory;
  /** Plain-language label, e.g. "Climate & environment". The only thing shown. */
  label: string;
}

/** The full per-user profile-tag blob. Versioned for forward-safe migration. */
export interface ProfileTagSelection {
  /** Schema version — bump on any breaking shape change. */
  schemaVersion: 1;
  /**
   * The selected tag ids, in selection order. Max length
   * `MAX_PROFILE_TAGS`. Every id MUST be a member of
   * `PROFILE_TAG_VOCABULARY` — the parser drops any unknown id
   * defensively.
   */
  selectedTagIds: string[];
}

// ── Cap + defaults ──────────────────────────────────────────────

/**
 * The selection cap. The card's "3-5 visible" ceiling. Single source of
 * truth — enforced in three places: on read
 * (`mergeTagSelectionWithDefaults` truncates), in the model (`toggleTag`
 * is a no-op past the cap), and in the UI (chips disabled at the cap).
 * Tags are optional, so there is no floor — zero is valid.
 */
export const MAX_PROFILE_TAGS = 5;

/** Canonical empty selection — tags are optional, so the default is zero tags. */
export const DEFAULT_PROFILE_TAG_SELECTION: ProfileTagSelection = Object.freeze({
  schemaVersion: 1,
  selectedTagIds: [],
});

// ── Pure helpers ────────────────────────────────────────────────

/** Build a fast id-membership set from a vocabulary. */
function vocabularyIdSet(
  vocabulary: ReadonlyArray<ProfileTagDefinition>,
): Set<string> {
  return new Set(vocabulary.map((t) => t.id));
}

/**
 * Defensive parse of whatever AsyncStorage returns. Always returns a
 * complete, valid `ProfileTagSelection` — never throws.
 *
 * The `selectedTagIds` list is filtered to ids that are
 *   (a) strings,
 *   (b) members of the supplied vocabulary,
 *   (c) de-duplicated (first occurrence kept), and
 *   (d) truncated to `MAX_PROFILE_TAGS`.
 *
 * A non-object input (`null`, an array, a primitive) → the default
 * empty selection. A non-array `selectedTagIds` → an empty list.
 */
export function mergeTagSelectionWithDefaults(
  partial: unknown,
  vocabulary: ReadonlyArray<ProfileTagDefinition>,
): ProfileTagSelection {
  if (typeof partial !== 'object' || partial === null || Array.isArray(partial)) {
    return { schemaVersion: 1, selectedTagIds: [] };
  }
  const p = partial as Record<string, unknown>;
  const raw = p.selectedTagIds;
  if (!Array.isArray(raw)) {
    return { schemaVersion: 1, selectedTagIds: [] };
  }
  const known = vocabularyIdSet(vocabulary);
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    if (!known.has(entry)) continue;
    if (seen.has(entry)) continue;
    seen.add(entry);
    cleaned.push(entry);
    if (cleaned.length >= MAX_PROFILE_TAGS) break;
  }
  return { schemaVersion: 1, selectedTagIds: cleaned };
}

/** `true` iff another tag can be added (the cap has room). */
export function canAddTag(
  selection: ProfileTagSelection,
  // vocabulary kept in the signature for symmetry / future membership
  // checks; the cap alone decides whether there is room.
  _vocabulary: ReadonlyArray<ProfileTagDefinition>,
): boolean {
  return selection.selectedTagIds.length < MAX_PROFILE_TAGS;
}

/** `true` iff `tagId` is currently selected. */
export function isTagSelected(
  selection: ProfileTagSelection,
  tagId: string,
): boolean {
  return selection.selectedTagIds.includes(tagId);
}

/**
 * Immutable toggle. Returns a NEW selection; `selection` is never
 * mutated.
 *   - If `tagId` is already selected → it is removed.
 *   - If `tagId` is not selected, is a vocabulary member, and the cap has
 *     room → it is appended (selection order preserved).
 *   - If `tagId` is not selected but the cap is reached → the selection
 *     is returned unchanged (model-level no-op; the UI also disables the
 *     chip).
 *   - If `tagId` is not in the vocabulary → no-op.
 *
 * Removing always works, even at the cap — so a user can deselect to
 * make room.
 */
export function toggleTag(
  selection: ProfileTagSelection,
  tagId: string,
  vocabulary: ReadonlyArray<ProfileTagDefinition>,
): ProfileTagSelection {
  if (isTagSelected(selection, tagId)) {
    return {
      schemaVersion: 1,
      selectedTagIds: selection.selectedTagIds.filter((id) => id !== tagId),
    };
  }
  // Adding a tag: must be a known vocabulary id and the cap must allow it.
  if (!vocabularyIdSet(vocabulary).has(tagId)) {
    return selection;
  }
  if (!canAddTag(selection, vocabulary)) {
    return selection;
  }
  return {
    schemaVersion: 1,
    selectedTagIds: [...selection.selectedTagIds, tagId],
  };
}

/** Every tag in `vocabulary` that belongs to `category`, in vocabulary order. */
export function getTagsByCategory(
  vocabulary: ReadonlyArray<ProfileTagDefinition>,
  category: ProfileTagCategory,
): ProfileTagDefinition[] {
  return vocabulary.filter((t) => t.category === category);
}

/** Resolve a tag id to its plain-language label, or `null` if unknown. */
export function resolveTagLabel(
  vocabulary: ReadonlyArray<ProfileTagDefinition>,
  tagId: string,
): string | null {
  const found = vocabulary.find((t) => t.id === tagId);
  return found ? found.label : null;
}

/**
 * Resolve the selected ids to their definitions, in selection order.
 * Ids with no vocabulary match are dropped (defensive — the parser
 * already filters, this guards a hand-built selection).
 */
export function selectedTagDefinitions(
  selection: ProfileTagSelection,
  vocabulary: ReadonlyArray<ProfileTagDefinition>,
): ProfileTagDefinition[] {
  const byId = new Map(vocabulary.map((t) => [t.id, t] as const));
  const out: ProfileTagDefinition[] = [];
  for (const id of selection.selectedTagIds) {
    const def = byId.get(id);
    if (def) out.push(def);
  }
  return out;
}
