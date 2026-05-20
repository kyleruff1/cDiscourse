/**
 * PR-002 — pure-model + storage coverage for the "Profile tags" feature.
 *
 * The repo's profile-tag logic lives in pure helpers (this file) and the
 * components are validated by separate source-scans
 * (`profileTagDoctrine.test.ts`, `profileTagVocabularySafety.test.ts`).
 * No React-Testing-Library `render()` — mirrors `userPreferencesModel.test.ts`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {
  canAddTag,
  DEFAULT_PROFILE_TAG_SELECTION,
  getTagsByCategory,
  isTagSelected,
  MAX_PROFILE_TAGS,
  mergeTagSelectionWithDefaults,
  resolveTagLabel,
  selectedTagDefinitions,
  toggleTag,
  type ProfileTagSelection,
} from '../src/features/profileTags/profileTagModel';
import {
  ALL_PROFILE_TAG_CATEGORIES,
  PROFILE_TAG_VOCABULARY,
} from '../src/features/profileTags/profileTagVocabulary';
import {
  loadProfileTags,
  saveProfileTags,
} from '../src/features/profileTags/profileTagsStorage';
import { profileTagsKey } from '../src/features/session/sessionKeys';

const V = PROFILE_TAG_VOCABULARY;

const sel = (ids: string[]): ProfileTagSelection => ({
  schemaVersion: 1,
  selectedTagIds: ids,
});

// ── mergeTagSelectionWithDefaults ───────────────────────────────

describe('mergeTagSelectionWithDefaults', () => {
  it('round-trips a valid blob with <= 5 known ids unchanged', () => {
    const input = sel(['topic_climate', 'style_steelman', 'avail_quick']);
    expect(mergeTagSelectionWithDefaults(input, V)).toEqual(input);
  });

  it.each([null, undefined, [], 'x', 42, true])(
    'returns the empty default for non-object input %p',
    (bad) => {
      const out = mergeTagSelectionWithDefaults(bad, V);
      expect(out).toEqual({ schemaVersion: 1, selectedTagIds: [] });
    },
  );

  it('returns an empty list when selectedTagIds is not an array', () => {
    const out = mergeTagSelectionWithDefaults(
      { schemaVersion: 1, selectedTagIds: 'topic_climate' },
      V,
    );
    expect(out.selectedTagIds).toEqual([]);
  });

  it('truncates an over-cap blob (8 valid ids) to exactly 5', () => {
    const eight = [
      'topic_climate',
      'topic_technology',
      'topic_science',
      'topic_economy',
      'topic_education',
      'topic_health',
      'topic_culture',
      'topic_history',
    ];
    const out = mergeTagSelectionWithDefaults(sel(eight), V);
    expect(out.selectedTagIds).toHaveLength(MAX_PROFILE_TAGS);
    expect(out.selectedTagIds).toEqual(eight.slice(0, MAX_PROFILE_TAGS));
  });

  it('drops an unknown / removed tag id and keeps the known ones', () => {
    const out = mergeTagSelectionWithDefaults(
      sel(['topic_climate', 'topic_made_up', 'style_friendly']),
      V,
    );
    expect(out.selectedTagIds).toEqual(['topic_climate', 'style_friendly']);
  });

  it('de-duplicates ids, keeping the first occurrence', () => {
    const out = mergeTagSelectionWithDefaults(
      sel(['topic_climate', 'topic_climate', 'style_concise']),
      V,
    );
    expect(out.selectedTagIds).toEqual(['topic_climate', 'style_concise']);
  });

  it('keeps only valid string ids when non-strings are mixed in', () => {
    const messy = [1, 'topic_climate', null, true, 'style_questions'] as unknown[];
    const out = mergeTagSelectionWithDefaults(sel(messy as string[]), V);
    expect(out.selectedTagIds).toEqual(['topic_climate', 'style_questions']);
  });

  it('always pins schemaVersion to 1', () => {
    const out = mergeTagSelectionWithDefaults(
      { schemaVersion: 99, selectedTagIds: ['topic_health'] },
      V,
    );
    expect(out.schemaVersion).toBe(1);
  });
});

// ── canAddTag ───────────────────────────────────────────────────

describe('canAddTag', () => {
  it('is true at 0 through 4 selected tags', () => {
    for (let n = 0; n < MAX_PROFILE_TAGS; n++) {
      const ids = V.slice(0, n).map((t) => t.id);
      expect(canAddTag(sel(ids), V)).toBe(true);
    }
  });

  it('is false at the 5-tag cap', () => {
    const ids = V.slice(0, MAX_PROFILE_TAGS).map((t) => t.id);
    expect(canAddTag(sel(ids), V)).toBe(false);
  });
});

// ── toggleTag ───────────────────────────────────────────────────

describe('toggleTag', () => {
  it('adds an unselected vocabulary id without mutating the input', () => {
    const prev = sel(['topic_climate']);
    const snapshot = JSON.parse(JSON.stringify(prev));
    const next = toggleTag(prev, 'style_steelman', V);
    expect(next.selectedTagIds).toEqual(['topic_climate', 'style_steelman']);
    expect(prev).toEqual(snapshot);
    expect(next).not.toBe(prev);
  });

  it('removes an already-selected id', () => {
    const next = toggleTag(sel(['topic_climate', 'style_steelman']), 'topic_climate', V);
    expect(next.selectedTagIds).toEqual(['style_steelman']);
  });

  it('is a no-op when adding past the 5-tag cap', () => {
    const five = V.slice(0, MAX_PROFILE_TAGS).map((t) => t.id);
    const prev = sel(five);
    const sixthId = V[MAX_PROFILE_TAGS].id;
    const next = toggleTag(prev, sixthId, V);
    expect(next).toBe(prev);
    expect(next.selectedTagIds).toHaveLength(MAX_PROFILE_TAGS);
  });

  it('is a no-op for an id that is not in the vocabulary', () => {
    const prev = sel(['topic_climate']);
    const next = toggleTag(prev, 'topic_made_up', V);
    expect(next).toBe(prev);
  });

  it('removes always works, even at the cap (deselect-to-make-room)', () => {
    const five = V.slice(0, MAX_PROFILE_TAGS).map((t) => t.id);
    const next = toggleTag(sel(five), five[0], V);
    expect(next.selectedTagIds).toHaveLength(MAX_PROFILE_TAGS - 1);
    expect(next.selectedTagIds).not.toContain(five[0]);
  });
});

// ── isTagSelected ───────────────────────────────────────────────

describe('isTagSelected', () => {
  it('reports membership correctly', () => {
    const s = sel(['topic_climate', 'avail_async']);
    expect(isTagSelected(s, 'topic_climate')).toBe(true);
    expect(isTagSelected(s, 'avail_async')).toBe(true);
    expect(isTagSelected(s, 'style_friendly')).toBe(false);
  });
});

// ── getTagsByCategory ───────────────────────────────────────────

describe('getTagsByCategory', () => {
  it('returns exactly the tags of each category with the expected sizes', () => {
    const sizes: Record<string, number> = {
      topic_interest: 10,
      debate_style: 8,
      availability: 5,
      accessibility_note: 5,
    };
    for (const category of ALL_PROFILE_TAG_CATEGORIES) {
      const tags = getTagsByCategory(V, category);
      expect(tags).toHaveLength(sizes[category]);
      for (const t of tags) {
        expect(t.category).toBe(category);
      }
    }
  });
});

// ── resolveTagLabel ─────────────────────────────────────────────

describe('resolveTagLabel', () => {
  it('maps a known id to its plain-language label', () => {
    expect(resolveTagLabel(V, 'topic_climate')).toBe('Climate & environment');
  });

  it('returns null for an unknown id', () => {
    expect(resolveTagLabel(V, 'topic_made_up')).toBeNull();
  });
});

// ── selectedTagDefinitions ──────────────────────────────────────

describe('selectedTagDefinitions', () => {
  it('resolves ids to definitions in selection order', () => {
    const s = sel(['style_concise', 'topic_climate']);
    const defs = selectedTagDefinitions(s, V);
    expect(defs.map((d) => d.id)).toEqual(['style_concise', 'topic_climate']);
    expect(defs[0].label).toBe('Prefers concise points');
  });

  it('drops ids with no vocabulary match', () => {
    const s = sel(['topic_climate', 'ghost_tag']);
    const defs = selectedTagDefinitions(s, V);
    expect(defs.map((d) => d.id)).toEqual(['topic_climate']);
  });
});

// ── DEFAULT_PROFILE_TAG_SELECTION ───────────────────────────────

describe('DEFAULT_PROFILE_TAG_SELECTION', () => {
  it('is an empty, version-1 selection (tags are optional, no floor)', () => {
    expect(DEFAULT_PROFILE_TAG_SELECTION.schemaVersion).toBe(1);
    expect(DEFAULT_PROFILE_TAG_SELECTION.selectedTagIds).toEqual([]);
  });
});

// ── Storage ─────────────────────────────────────────────────────

describe('profileTagsStorage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it('save -> load round-trips a selection', async () => {
    const s = sel(['topic_climate', 'style_steelman']);
    await saveProfileTags('user-1', s);
    const loaded = await loadProfileTags('user-1');
    expect(loaded).toEqual(s);
  });

  it('load with no key returns the empty default', async () => {
    const loaded = await loadProfileTags('never-saved');
    expect(loaded).toEqual({ schemaVersion: 1, selectedTagIds: [] });
  });

  it('load with corrupt JSON returns the default without throwing', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValueOnce('{not json');
    const loaded = await loadProfileTags('user-1');
    expect(loaded).toEqual({ schemaVersion: 1, selectedTagIds: [] });
  });

  it('load with a non-object garbage blob rebuilds the default', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValueOnce('[1,2,3]');
    const loaded = await loadProfileTags('user-1');
    expect(loaded).toEqual({ schemaVersion: 1, selectedTagIds: [] });
  });

  it('load truncates an over-cap stored blob to 5 (cap enforced on read)', async () => {
    const eight = PROFILE_TAG_VOCABULARY.slice(0, 8).map((t) => t.id);
    jest
      .spyOn(AsyncStorage, 'getItem')
      .mockResolvedValueOnce(JSON.stringify(sel(eight)));
    const loaded = await loadProfileTags('user-1');
    expect(loaded.selectedTagIds).toHaveLength(MAX_PROFILE_TAGS);
  });

  it('load drops an unknown id from a stored blob', async () => {
    jest
      .spyOn(AsyncStorage, 'getItem')
      .mockResolvedValueOnce(JSON.stringify(sel(['topic_climate', 'nope_tag'])));
    const loaded = await loadProfileTags('user-1');
    expect(loaded.selectedTagIds).toEqual(['topic_climate']);
  });

  it('load with a storage error returns the default', async () => {
    jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValueOnce(new Error('storage error'));
    const loaded = await loadProfileTags('user-1');
    expect(loaded).toEqual({ schemaVersion: 1, selectedTagIds: [] });
  });

  it('save swallows a storage error (non-fatal)', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
    await expect(
      saveProfileTags('user-1', sel(['topic_climate'])),
    ).resolves.toBeUndefined();
  });

  it('uses the profileTagsKey shape', async () => {
    const setSpy = jest.spyOn(AsyncStorage, 'setItem');
    await saveProfileTags('user-9', sel(['topic_health']));
    expect(setSpy).toHaveBeenCalledWith(
      profileTagsKey('user-9'),
      expect.any(String),
    );
  });

  it('keys a null userId under the anon key', async () => {
    const setSpy = jest.spyOn(AsyncStorage, 'setItem');
    await saveProfileTags(null, sel(['topic_health']));
    expect(setSpy).toHaveBeenCalledWith(
      profileTagsKey('anon'),
      expect.any(String),
    );
  });
});
