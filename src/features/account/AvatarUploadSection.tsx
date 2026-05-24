/**
 * PR-003 — AvatarUploadSection.
 *
 * Presentational component mounted inside AccountScreen's existing card
 * above the User ID row. Three visual states:
 *   1. No avatar set — GeneratedAvatar placeholder + "Upload photo" button.
 *   2. Avatar present, idle — <Image> + "Change" + "Remove" buttons.
 *   3. Uploading — locally-rendered picked image with translucent
 *      ActivityIndicator overlay; buttons disabled.
 *
 * Optimistic UI (Q6): on picker success, the local URI is shown
 * immediately and the Edge Function call runs in the background. On
 * success, the local state swaps to the returned publicUrl?v=<timestamp>.
 * On failure, local state reverts to the prior avatarPath / placeholder
 * and an inline plain-copy error appears.
 *
 * Removal uses a two-tap confirmation pattern (no modal dep).
 *
 * Doctrine:
 *   - No <TextInput> for any avatar field (Q4 acceptance criterion).
 *   - Internal codes never surface (the moderation 'removed' status
 *     flips to GeneratedAvatar with no badge or copy).
 *   - All Pressables expose role + label + state, 44px min hit target.
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { GeneratedAvatar } from '../preferences/GeneratedAvatar';
import {
  AVATAR_ALLOWED_MIME_TYPES,
  type AvatarMimeType,
  messageForAvatarError,
  removeAvatar,
  resolveAvatarPublicUrl,
  uploadAvatar,
  validateAvatarSelection,
} from './avatarApi';
import { CONTROL, STATUS, SURFACE_TOKENS } from '../../lib/designTokens';

interface Props {
  userId: string | null;
  displayName: string | null;
  avatarPath: string | null;
  avatarUpdatedAt: string | null;
  onChanged: () => void;
}

type UploadState =
  | { kind: 'idle' }
  | { kind: 'uploading'; localUri: string }
  | { kind: 'error'; message: string };

type RemoveState = 'idle' | 'confirming' | 'removing';

const AVATAR_SIZE = 80;

export function AvatarUploadSection({
  userId,
  displayName,
  avatarPath,
  avatarUpdatedAt,
  onChanged,
}: Props) {
  const [uploadState, setUploadState] = useState<UploadState>({ kind: 'idle' });
  const [removeState, setRemoveState] = useState<RemoveState>('idle');
  const [removeError, setRemoveError] = useState<string | null>(null);

  const currentUrl = resolveAvatarPublicUrl(avatarPath, {
    cacheBustToken: avatarUpdatedAt,
  });

  const handlePickAndUpload = useCallback(async () => {
    setUploadState({ kind: 'idle' });

    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        exif: false,
      });
    } catch {
      setUploadState({
        kind: 'error',
        message: 'To upload a photo, allow CDiscourse to read your photo library in system settings.',
      });
      return;
    }

    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset || !asset.uri || !asset.mimeType) {
      setUploadState({
        kind: 'error',
        message: messageForAvatarError('empty'),
      });
      return;
    }

    const mime = asset.mimeType;
    if (!(AVATAR_ALLOWED_MIME_TYPES as readonly string[]).includes(mime)) {
      setUploadState({
        kind: 'error',
        message: messageForAvatarError('mime_not_allowed'),
      });
      return;
    }

    const validation = validateAvatarSelection({
      mimeType: mime,
      byteLength: typeof asset.fileSize === 'number' ? asset.fileSize : 1,
    });
    if (!validation.ok) {
      setUploadState({
        kind: 'error',
        message: messageForAvatarError(validation.error),
      });
      return;
    }

    // Optimistic state: show the picked image locally while the Edge
    // Function call runs.
    setUploadState({ kind: 'uploading', localUri: asset.uri });

    const uploadResult = await uploadAvatar({
      uri: asset.uri,
      mimeType: mime as AvatarMimeType,
    });

    if (uploadResult.ok) {
      setUploadState({ kind: 'idle' });
      onChanged();
    } else {
      // Revert: clear the local URI; the consumer's avatarPath is
      // unchanged so the prior avatar (or placeholder) re-renders.
      setUploadState({ kind: 'error', message: uploadResult.message });
    }
  }, [onChanged]);

  const handleStartRemove = useCallback(() => {
    setRemoveError(null);
    setRemoveState('confirming');
  }, []);

  const handleConfirmRemove = useCallback(async () => {
    setRemoveError(null);
    setRemoveState('removing');
    const result = await removeAvatar();
    if (result.ok) {
      setRemoveState('idle');
      onChanged();
    } else {
      setRemoveError(result.message);
      setRemoveState('confirming');
    }
  }, [onChanged]);

  const handleCancelRemove = useCallback(() => {
    setRemoveState('idle');
    setRemoveError(null);
  }, []);

  const isUploading = uploadState.kind === 'uploading';
  const isRemoving = removeState === 'removing';
  const interactionDisabled = isUploading || isRemoving;

  const showingLocalPicked = uploadState.kind === 'uploading';
  const showingRemoteImage = !showingLocalPicked && currentUrl !== null;

  return (
    <View testID="avatar-upload-section" style={styles.container}>
      <View style={styles.row}>
        <View style={styles.avatarSlot}>
          {showingLocalPicked && (
            <>
              <Image
                testID="avatar-current-image"
                source={{ uri: (uploadState as { localUri: string }).localUri }}
                style={styles.image}
                accessibilityRole="image"
                accessibilityLabel="Your profile photo"
              />
              <View testID="avatar-upload-spinner" style={styles.spinnerOverlay}>
                <ActivityIndicator color={CONTROL.primary.fg} />
              </View>
            </>
          )}
          {!showingLocalPicked && showingRemoteImage && currentUrl && (
            <Image
              testID="avatar-current-image"
              source={{ uri: currentUrl }}
              style={styles.image}
              accessibilityRole="image"
              accessibilityLabel="Your profile photo"
            />
          )}
          {!showingLocalPicked && !showingRemoteImage && (
            <View testID="avatar-generated-placeholder">
              <GeneratedAvatar
                displayName={displayName}
                seed={userId}
                size={AVATAR_SIZE}
              />
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable
            testID="avatar-upload-button"
            onPress={handlePickAndUpload}
            disabled={interactionDisabled}
            style={[styles.primaryBtn, interactionDisabled && styles.btnDisabled]}
            accessibilityRole="button"
            accessibilityLabel={
              currentUrl ? 'Change profile photo' : 'Upload a profile photo'
            }
            accessibilityState={{ disabled: interactionDisabled, busy: isUploading }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.primaryBtnText}>
              {currentUrl ? 'Change' : 'Upload photo'}
            </Text>
          </Pressable>

          {currentUrl && removeState === 'idle' && (
            <Pressable
              testID="avatar-remove-button"
              onPress={handleStartRemove}
              disabled={interactionDisabled}
              style={[styles.secondaryBtn, interactionDisabled && styles.btnDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Remove profile photo"
              accessibilityState={{ disabled: interactionDisabled }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.secondaryBtnText}>Remove</Text>
            </Pressable>
          )}

          {removeState !== 'idle' && (
            <View style={styles.confirmRow}>
              <Pressable
                testID="avatar-remove-confirm-button"
                onPress={handleConfirmRemove}
                disabled={isRemoving}
                style={[styles.dangerBtn, isRemoving && styles.btnDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Confirm removing profile photo"
                accessibilityState={{ disabled: isRemoving, busy: isRemoving }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.dangerBtnText}>
                  {isRemoving ? 'Removing…' : 'Confirm remove'}
                </Text>
              </Pressable>
              <Pressable
                testID="avatar-remove-cancel-button"
                onPress={handleCancelRemove}
                disabled={isRemoving}
                style={[styles.secondaryBtn, isRemoving && styles.btnDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Cancel removal"
                accessibilityState={{ disabled: isRemoving }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {uploadState.kind === 'error' && (
        <Text testID="avatar-error-text" style={styles.errorText} accessibilityLiveRegion="polite">
          {uploadState.message}
        </Text>
      )}

      {removeError && (
        <Text testID="avatar-remove-error-text" style={styles.errorText} accessibilityLiveRegion="polite">
          {removeError}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_TOKENS.divider,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarSlot: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: SURFACE_TOKENS.raised,
  },
  image: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  spinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: AVATAR_SIZE / 2,
  },
  actions: {
    flex: 1,
    gap: 8,
  },
  primaryBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    backgroundColor: CONTROL.primary.bg,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: CONTROL.primary.fg,
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    backgroundColor: SURFACE_TOKENS.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  dangerBtn: {
    minHeight: 44,
    flex: 1,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: STATUS.danger.bg,
    borderWidth: 1,
    borderColor: STATUS.danger.fg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerBtnText: {
    color: STATUS.danger.fg,
    fontSize: 14,
    fontWeight: '700',
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: STATUS.danger.fg,
  },
});
