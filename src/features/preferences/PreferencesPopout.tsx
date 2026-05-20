/**
 * PR-001 — PreferencesPopout.
 *
 * The "My preferences" bottom-sheet, opened from the app header. Reuses
 * the established core `Modal` bottom-sheet pattern (DeletionRequestSheet)
 * — no new overlay mechanism, no router drawer, no new dependency.
 *
 * Presentational only: it takes the hook's values + an `onClose` and
 * renders the nine fields in a `ScrollView`.
 *
 * Doctrine (cdiscourse-doctrine §1/§6/§10, acceptance criteria):
 *   - Exposes NO role / permission / admin / moderation control.
 *   - Captures NO secret, token, password, or auth field.
 *   - Reads no scoring / engine / validation module — a preference is
 *     cosmetic and never reaches a gate.
 *   - The notification field is an honest stub; the contact email is
 *     read-only; the colour-blind sim modes are persisted-but-inert with
 *     honest "coming later" copy.
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GeneratedAvatar } from './GeneratedAvatar';
import { PreferenceSegmentedControl, PreferenceToggleRow } from './PreferenceRow';
import {
  AVATAR_COPY,
  COLOR_MODE_COPY,
  CONTACT_EMAIL_COPY,
  DENSITY_COPY,
  DISPLAY_NAME_COPY,
  NOTIFICATIONS_COPY,
  PREFERENCES_COPY,
  REDUCE_MOTION_COPY,
  ROOM_ENTRY_COPY,
  SIDE_LABEL_COPY,
} from './preferencesCopy';
// PR-002 — copy for the new "Profile tags" row that opens the
// ProfileTagPopout. The popout itself is a separate feature folder.
import { PROFILE_TAGS_ROW_COPY } from '../profileTags/profileTagCopy';
import {
  isHighContrast,
  type ColorAccessibilityMode,
  type DefaultRoomEntryPreference,
  type DefaultSideLabelPreference,
  type DensityPreference,
  type ReduceMotionPreference,
  type UserPreferences,
} from './userPreferencesModel';

export interface PreferencesPopoutProps {
  visible: boolean;
  onClose: () => void;
  /** Stable seed for the generated avatar (the user id). */
  userId: string | null;
  // Display name — account data, NOT from the preferences blob.
  displayName: string | null;
  displayNameSaving: boolean;
  displayNameSaveError: string | null;
  onSaveDisplayName: (name: string) => Promise<boolean>;
  // Contact email — read-only display (Correction 2).
  contactEmail: string | null;
  // Preference blob.
  preferences: UserPreferences;
  effectiveReduceMotion: boolean;
  osReduceMotion: boolean;
  onUpdatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => void;
  // PR-002 — opens the separate ProfileTagPopout (mounted by App.tsx).
  onOpenProfileTags: () => void;
  /** PR-002 — number of selected profile tags, shown in the new row. */
  profileTagCount: number;
}

const DISPLAY_NAME_MAX = 60;

export function PreferencesPopout({
  visible,
  onClose,
  userId,
  displayName,
  displayNameSaving,
  displayNameSaveError,
  onSaveDisplayName,
  contactEmail,
  preferences,
  effectiveReduceMotion,
  osReduceMotion,
  onUpdatePreference,
  onOpenProfileTags,
  profileTagCount,
}: PreferencesPopoutProps) {
  const [draftName, setDraftName] = useState(displayName ?? '');
  const [savedFlash, setSavedFlash] = useState(false);

  // Keep the draft in sync when the popout reopens with a fresh name.
  useEffect(() => {
    if (visible) {
      setDraftName(displayName ?? '');
      setSavedFlash(false);
    }
  }, [visible, displayName]);

  const trimmedName = draftName.trim();
  const canSaveName =
    trimmedName.length > 0 && !displayNameSaving && trimmedName !== (displayName ?? '').trim();

  const handleSaveName = async () => {
    if (!canSaveName) return;
    const ok = await onSaveDisplayName(trimmedName);
    if (ok) setSavedFlash(true);
  };

  const highContrast = isHighContrast(preferences.colorMode);
  const showColorComingSoon =
    preferences.colorMode === 'protanopia' ||
    preferences.colorMode === 'deuteranopia' ||
    preferences.colorMode === 'tritanopia';

  return (
    <Modal
      visible={visible}
      transparent
      // accessibility-targets: snap (no slide) when motion is reduced.
      animationType={effectiveReduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="preferences-popout">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTextCol}>
              <Text style={styles.title}>{PREFERENCES_COPY.title}</Text>
              <Text style={styles.subtitle}>{PREFERENCES_COPY.subtitle}</Text>
            </View>
            <Pressable
              testID="preferences-close"
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={PREFERENCES_COPY.close}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={[styles.closeBtn, highContrast && styles.closeBtnHighContrast]}
            >
              <Text style={styles.closeBtnText}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
          >
            {/* Field 1 — Display name */}
            <View style={styles.field} testID="pref-field-display-name">
              <Text style={styles.label}>{DISPLAY_NAME_COPY.label}</Text>
              <Text style={styles.helper}>{DISPLAY_NAME_COPY.helper}</Text>
              <TextInput
                testID="pref-display-name-input"
                style={[styles.input, highContrast && styles.inputHighContrast]}
                value={draftName}
                onChangeText={(s) => {
                  setDraftName(s.slice(0, DISPLAY_NAME_MAX));
                  setSavedFlash(false);
                }}
                placeholder={DISPLAY_NAME_COPY.placeholder}
                placeholderTextColor="#64748b"
                maxLength={DISPLAY_NAME_MAX}
                accessibilityLabel={DISPLAY_NAME_COPY.inputAccessibilityLabel}
                editable={!displayNameSaving}
              />
              <Pressable
                testID="pref-display-name-save"
                onPress={handleSaveName}
                disabled={!canSaveName}
                accessibilityRole="button"
                accessibilityLabel={DISPLAY_NAME_COPY.save}
                accessibilityState={{ disabled: !canSaveName, busy: displayNameSaving }}
                style={[styles.saveBtn, !canSaveName && styles.saveBtnDisabled]}
              >
                <Text style={styles.saveBtnText}>
                  {displayNameSaving ? DISPLAY_NAME_COPY.saving : DISPLAY_NAME_COPY.save}
                </Text>
              </Pressable>
              {trimmedName.length === 0 ? (
                <Text style={styles.hintText}>{DISPLAY_NAME_COPY.emptyHint}</Text>
              ) : null}
              {savedFlash && !displayNameSaveError ? (
                <Text style={styles.successText} accessibilityLiveRegion="polite">
                  {DISPLAY_NAME_COPY.saved}
                </Text>
              ) : null}
              {displayNameSaveError ? (
                <Text style={styles.errorText} accessibilityLiveRegion="polite">
                  {displayNameSaveError}
                </Text>
              ) : null}
            </View>

            {/* Field 2 — Avatar preview */}
            <View style={styles.field} testID="pref-field-avatar">
              <Text style={styles.label}>{AVATAR_COPY.label}</Text>
              <Text style={styles.helper}>{AVATAR_COPY.helper}</Text>
              <GeneratedAvatar
                displayName={draftName || displayName}
                seed={userId}
                size={56}
                highContrast={highContrast}
              />
            </View>

            {/* Field 3 — Contact email (read-only, Correction 2) */}
            <View style={styles.field} testID="pref-field-contact-email">
              <Text style={styles.label}>{CONTACT_EMAIL_COPY.label}</Text>
              <Text style={styles.helper}>{CONTACT_EMAIL_COPY.helper}</Text>
              <Text style={styles.emailValue} testID="pref-contact-email-value">
                {contactEmail ?? CONTACT_EMAIL_COPY.noneOnFile}
              </Text>
              <Text style={styles.hintText} testID="pref-contact-email-note">
                {CONTACT_EMAIL_COPY.notAvailableNote}
              </Text>
            </View>

            {/* Field 4 — Notification preference (honest stub) */}
            <PreferenceToggleRow
              testID="pref-field-notifications"
              label={NOTIFICATIONS_COPY.label}
              helper={NOTIFICATIONS_COPY.helper}
              value={preferences.notificationsOptInStub}
              onChange={(v) => onUpdatePreference('notificationsOptInStub', v)}
              switchAccessibilityLabel={NOTIFICATIONS_COPY.switchAccessibilityLabel}
              switchTestID="pref-notifications-switch"
            />

            {/* Field 5 — Default room entry */}
            <PreferenceSegmentedControl<DefaultRoomEntryPreference>
              testID="pref-field-default-room-entry"
              testIDPrefix="pref-default-room-entry"
              label={ROOM_ENTRY_COPY.label}
              helper={ROOM_ENTRY_COPY.helper}
              value={preferences.defaultRoomEntry}
              onChange={(v) => onUpdatePreference('defaultRoomEntry', v)}
              highContrast={highContrast}
              options={[
                { value: 'observe', label: ROOM_ENTRY_COPY.options.observe },
                { value: 'last_used', label: ROOM_ENTRY_COPY.options.last_used },
              ]}
            />

            {/* Field 6 — Visual density */}
            <PreferenceSegmentedControl<DensityPreference>
              testID="pref-field-density"
              testIDPrefix="pref-density"
              label={DENSITY_COPY.label}
              helper={DENSITY_COPY.helper}
              value={preferences.density}
              onChange={(v) => onUpdatePreference('density', v)}
              highContrast={highContrast}
              options={[
                { value: 'compact', label: DENSITY_COPY.options.compact },
                { value: 'normal', label: DENSITY_COPY.options.normal },
                { value: 'expanded', label: DENSITY_COPY.options.expanded },
              ]}
            />

            {/* Field 7 — Colour accessibility */}
            <PreferenceSegmentedControl<ColorAccessibilityMode>
              testID="pref-field-color-mode"
              testIDPrefix="pref-color-mode"
              label={COLOR_MODE_COPY.label}
              helper={COLOR_MODE_COPY.helper}
              value={preferences.colorMode}
              onChange={(v) => onUpdatePreference('colorMode', v)}
              highContrast={highContrast}
              options={[
                { value: 'default', label: COLOR_MODE_COPY.options.default },
                { value: 'high_contrast', label: COLOR_MODE_COPY.options.high_contrast },
                { value: 'protanopia', label: COLOR_MODE_COPY.options.protanopia },
                { value: 'deuteranopia', label: COLOR_MODE_COPY.options.deuteranopia },
                { value: 'tritanopia', label: COLOR_MODE_COPY.options.tritanopia },
              ]}
            />
            {highContrast ? (
              <Text style={styles.noteText}>{COLOR_MODE_COPY.highContrastNote}</Text>
            ) : null}
            {showColorComingSoon ? (
              <Text style={styles.noteText} testID="pref-color-mode-coming-note">
                {COLOR_MODE_COPY.comingSoonNote}
              </Text>
            ) : null}

            {/* Field 8 — Reduce motion */}
            <PreferenceSegmentedControl<ReduceMotionPreference>
              testID="pref-field-reduce-motion"
              testIDPrefix="pref-reduce-motion"
              label={REDUCE_MOTION_COPY.label}
              helper={REDUCE_MOTION_COPY.helper}
              value={preferences.reduceMotion}
              onChange={(v) => onUpdatePreference('reduceMotion', v)}
              highContrast={highContrast}
              options={[
                { value: 'system', label: REDUCE_MOTION_COPY.options.system },
                { value: 'on', label: REDUCE_MOTION_COPY.options.on },
                { value: 'off', label: REDUCE_MOTION_COPY.options.off },
              ]}
            />
            {preferences.reduceMotion === 'system' ? (
              <Text style={styles.noteText} testID="pref-reduce-motion-system-note">
                {osReduceMotion
                  ? REDUCE_MOTION_COPY.systemHintOn
                  : REDUCE_MOTION_COPY.systemHintOff}
              </Text>
            ) : null}

            {/* Field 9 — Default side label (persist-only, honest copy) */}
            <PreferenceSegmentedControl<DefaultSideLabelPreference>
              testID="pref-field-default-side-label"
              testIDPrefix="pref-default-side-label"
              label={SIDE_LABEL_COPY.label}
              helper={SIDE_LABEL_COPY.helper}
              value={preferences.defaultSideLabel}
              onChange={(v) => onUpdatePreference('defaultSideLabel', v)}
              highContrast={highContrast}
              options={[
                { value: 'for_against', label: SIDE_LABEL_COPY.options.for_against },
                { value: 'side_a_b', label: SIDE_LABEL_COPY.options.side_a_b },
              ]}
            />
            <Text style={styles.noteText} testID="pref-side-label-note">
              {SIDE_LABEL_COPY.persistOnlyNote}
            </Text>

            {/* Field 10 — Profile tags (PR-002). A Pressable that opens
                the separate ProfileTagPopout. NOT a TextInput — the
                preferences popout still has exactly one TextInput. */}
            <View style={styles.field} testID="pref-field-profile-tags">
              <Text style={styles.label}>{PROFILE_TAGS_ROW_COPY.label}</Text>
              <Text style={styles.helper}>{PROFILE_TAGS_ROW_COPY.helper}</Text>
              <Pressable
                testID="pref-profile-tags-open"
                onPress={onOpenProfileTags}
                accessibilityRole="button"
                accessibilityLabel={PROFILE_TAGS_ROW_COPY.open}
                accessibilityHint={PROFILE_TAGS_ROW_COPY.openHint}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[
                  styles.profileTagsRow,
                  highContrast && styles.profileTagsRowHighContrast,
                ]}
              >
                <Text style={styles.profileTagsRowCount} testID="pref-profile-tags-count">
                  {profileTagCount > 0
                    ? PROFILE_TAGS_ROW_COPY.countSome(profileTagCount)
                    : PROFILE_TAGS_ROW_COPY.countNone}
                </Text>
                <Text style={styles.profileTagsRowChevron}>›</Text>
              </Pressable>
            </View>
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
  closeBtnHighContrast: {
    borderWidth: 2,
    borderColor: '#cbd5e1',
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
  field: {
    marginBottom: 18,
  },
  label: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  helper: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  noteText: {
    color: '#fcd34d',
    fontSize: 12,
    lineHeight: 16,
    marginTop: -8,
    marginBottom: 18,
  },
  hintText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#020617',
    color: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  inputHighContrast: {
    borderWidth: 2,
    borderColor: '#cbd5e1',
  },
  saveBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingHorizontal: 18,
    minHeight: 44,
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  emailValue: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  successText: {
    color: '#6ee7b7',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    marginTop: 6,
  },
  // PR-002 — the "Profile tags" row Pressable.
  profileTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#020617',
  },
  profileTagsRowHighContrast: {
    borderWidth: 2,
    borderColor: '#cbd5e1',
  },
  profileTagsRowCount: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  profileTagsRowChevron: {
    color: '#94a3b8',
    fontSize: 20,
    fontWeight: '700',
  },
});
