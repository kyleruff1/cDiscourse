/**
 * PR-002 — ProfileTagPopout.
 *
 * The "Profile tags" bottom-sheet, opened from a row inside PR-001's
 * "My preferences" popout. Reuses the established core `Modal`
 * bottom-sheet pattern verbatim (DeletionRequestSheet / PreferencesPopout)
 * — no new overlay mechanism, no router drawer, no new dependency.
 *
 * Presentational only: it takes the hook's values + an `onClose` and
 * renders the four category sections of selectable chips in a `ScrollView`.
 *
 * Doctrine (cdiscourse-doctrine §1/§6/§9/§10, the card's DISALLOWED list):
 *   - Exposes NO role / permission / admin / moderation control.
 *   - Captures NO secret, token, password, or auth field.
 *   - Reads no scoring / engine / validation module — a profile tag is
 *     inert social context and never reaches a gate.
 *   - There is no editable / free-text tag entry anywhere — tags are
 *     only selectable from the closed `PROFILE_TAG_VOCABULARY`.
 *   - Tags are optional (zero is valid) — the empty state says so plainly.
 */

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProfileTagChip } from './ProfileTagChip';
import {
  chipAccessibilityLabel,
  PROFILE_TAG_CATEGORY_COPY,
  PROFILE_TAGS_POPOUT_COPY,
} from './profileTagCopy';
import {
  getTagsByCategory,
  isTagSelected,
  MAX_PROFILE_TAGS,
  type ProfileTagCategory,
  type ProfileTagSelection,
} from './profileTagModel';
import {
  ALL_PROFILE_TAG_CATEGORIES,
  PROFILE_TAG_VOCABULARY,
} from './profileTagVocabulary';

export interface ProfileTagPopoutProps {
  visible: boolean;
  onClose: () => void;
  selection: ProfileTagSelection;
  count: number;
  atLimit: boolean;
  onToggleTag: (tagId: string) => void;
  onClearTags: () => void;
  /** Disable the open animation when motion is reduced (PR-001's hook). */
  reduceMotion: boolean;
}

export function ProfileTagPopout({
  visible,
  onClose,
  selection,
  count,
  atLimit,
  onToggleTag,
  onClearTags,
  reduceMotion,
}: ProfileTagPopoutProps) {
  return (
    <Modal
      visible={visible}
      transparent
      // accessibility-targets: snap (no slide) when motion is reduced.
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="profile-tag-popout">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <Text style={styles.title}>{PROFILE_TAGS_POPOUT_COPY.title}</Text>
              <Text style={styles.subtitle}>{PROFILE_TAGS_POPOUT_COPY.subtitle}</Text>
            </View>
            <Pressable
              testID="profile-tag-close"
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={PROFILE_TAGS_POPOUT_COPY.close}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
          >
            {/* Optional-tags helper */}
            <Text style={styles.optionalHelper}>
              {PROFILE_TAGS_POPOUT_COPY.optionalHelper}
            </Text>

            {/* Live selected-count line */}
            <Text
              style={styles.countLine}
              testID="profile-tag-count"
              accessibilityLiveRegion="polite"
            >
              {PROFILE_TAGS_POPOUT_COPY.countLine(count, MAX_PROFILE_TAGS)}
            </Text>

            {/* At-limit note */}
            {atLimit ? (
              <Text style={styles.atLimitNote} testID="profile-tag-at-limit">
                {PROFILE_TAGS_POPOUT_COPY.atLimitNote}
              </Text>
            ) : null}

            {/* Empty state — tags are optional */}
            {count === 0 ? (
              <Text style={styles.emptyState} testID="profile-tag-empty">
                {PROFILE_TAGS_POPOUT_COPY.emptyState}
              </Text>
            ) : null}

            {/* Clear-all (only when at least one tag is selected) */}
            {count > 0 ? (
              <Pressable
                testID="profile-tag-clear"
                onPress={onClearTags}
                accessibilityRole="button"
                accessibilityLabel={PROFILE_TAGS_POPOUT_COPY.clearAll}
                accessibilityHint={PROFILE_TAGS_POPOUT_COPY.clearAllHint}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.clearBtn}
              >
                <Text style={styles.clearBtnText}>
                  {PROFILE_TAGS_POPOUT_COPY.clearAll}
                </Text>
              </Pressable>
            ) : null}

            {/* Four category sections */}
            {ALL_PROFILE_TAG_CATEGORIES.map((category: ProfileTagCategory) => {
              const categoryCopy = PROFILE_TAG_CATEGORY_COPY[category];
              const tags = getTagsByCategory(PROFILE_TAG_VOCABULARY, category);
              return (
                <View
                  key={category}
                  style={styles.section}
                  testID={`profile-tag-section-${category}`}
                >
                  <Text style={styles.sectionTitle}>{categoryCopy.title}</Text>
                  <Text style={styles.sectionHelper}>{categoryCopy.helper}</Text>
                  <View style={styles.chipGrid}>
                    {tags.map((definition) => {
                      const selected = isTagSelected(selection, definition.id);
                      const disabled = atLimit && !selected;
                      return (
                        <ProfileTagChip
                          key={definition.id}
                          definition={definition}
                          selected={selected}
                          disabled={disabled}
                          onPress={() => onToggleTag(definition.id)}
                          accessibilityLabel={chipAccessibilityLabel(
                            definition.label,
                            categoryCopy.title,
                            selected,
                          )}
                          testID={`profile-tag-chip-${definition.id}`}
                        />
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#1f2937',
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
    gap: 12,
  },
  headerTextCol: {
    flex: 1,
  },
  title: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
  },
  closeBtnText: {
    color: '#e2e8f0',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 28,
    paddingTop: 6,
  },
  optionalHelper: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  countLine: {
    color: '#a5b4fc',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  atLimitNote: {
    color: '#fcd34d',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  emptyState: {
    color: '#94a3b8',
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  clearBtn: {
    alignSelf: 'flex-start',
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: '#1e293b',
    marginBottom: 14,
  },
  clearBtnText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  sectionHelper: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
