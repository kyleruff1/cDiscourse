import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { TextInputField } from '../../components/TextInputField';
import { Button } from '../../components/Button';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ROOM_VISIBILITY_COPY } from '../arguments/gameCopy';
import { SURFACE_TOKENS } from '../../lib/designTokens';
import type { CreateDebateInput, RoomVisibility } from './types';

interface Props {
  onSubmit: (input: CreateDebateInput) => Promise<void>;
  onCancel: () => void;
}

/**
 * QOL-039 — visibility option row with a single radio target. 44px hit
 * surface per `accessibility-targets`; shape + label + check carry the
 * selection state — color is not the only signal.
 */
function VisibilityOption({
  value,
  label,
  helper,
  selected,
  onSelect,
}: {
  value: RoomVisibility;
  label: string;
  helper: string;
  selected: boolean;
  onSelect: (next: RoomVisibility) => void;
}) {
  return (
    <Pressable
      onPress={() => onSelect(value)}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: false }}
      accessibilityLabel={`${label}. ${helper}`}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[styles.visibilityOption, selected ? styles.visibilityOptionSelected : null]}
      testID={`create-debate-visibility-${value}`}
    >
      <View style={styles.visibilityOptionHeader}>
        <Text style={[styles.visibilityCheck, selected ? styles.visibilityCheckOn : null]}>
          {selected ? '●' : '○'}
        </Text>
        <Text style={[styles.visibilityLabel, selected ? styles.visibilityLabelSelected : null]}>
          {label}
        </Text>
      </View>
      <Text style={styles.visibilityHelper}>{helper}</Text>
    </Pressable>
  );
}

export function CreateDebateForm({ onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState('');
  const [resolution, setResolution] = useState('');
  const [description, setDescription] = useState('');
  // QOL-039 — visibility defaults to 'public' (today's behavior).
  const [visibility, setVisibility] = useState<RoomVisibility>('public');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = title.trim().length > 0 && resolution.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        resolution: resolution.trim(),
        description: description.trim(),
        visibility,
      });
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setSubmitting(false);
  };

  return (
    <Screen title="New Argument">
      <View style={styles.form}>
        <TextInputField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="A short label for this argument"
        />
        <TextInputField
          label="Resolution"
          value={resolution}
          onChangeText={setResolution}
          placeholder="The falsifiable proposition being debated"
        />
        <TextInputField
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Background context or rules"
        />
        {/* QOL-039 — visibility control. radiogroup of two 44px Pressables;
            shape (check mark) + bolder label both carry the selection state
            (color is not the only signal). */}
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={ROOM_VISIBILITY_COPY.group_label}
          style={styles.visibilityGroup}
          testID="create-debate-visibility-group"
        >
          <Text style={styles.visibilityGroupLabel}>{ROOM_VISIBILITY_COPY.group_label}</Text>
          <View style={styles.visibilityRow}>
            <VisibilityOption
              value="public"
              label={ROOM_VISIBILITY_COPY.option_public_label}
              helper={ROOM_VISIBILITY_COPY.option_public_helper}
              selected={visibility === 'public'}
              onSelect={setVisibility}
            />
            <VisibilityOption
              value="private"
              label={ROOM_VISIBILITY_COPY.option_private_label}
              helper={ROOM_VISIBILITY_COPY.option_private_helper}
              selected={visibility === 'private'}
              onSelect={setVisibility}
            />
          </View>
        </View>
        {error ? <ErrorNotice message={error} /> : null}
        <Button
          label="Create Argument"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!isValid}
        />
        <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={submitting} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 4 },
  visibilityGroup: {
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  visibilityGroupLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: SURFACE_TOKENS.textSecondary,
  },
  visibilityRow: {
    gap: 8,
  },
  visibilityOption: {
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    backgroundColor: SURFACE_TOKENS.elevated,
    gap: 4,
  },
  visibilityOptionSelected: {
    borderColor: SURFACE_TOKENS.focusRing,
    borderWidth: 2,
    backgroundColor: SURFACE_TOKENS.raised,
  },
  visibilityOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  visibilityCheck: {
    fontSize: 16,
    color: SURFACE_TOKENS.textMuted,
  },
  visibilityCheckOn: {
    color: SURFACE_TOKENS.textPrimary,
  },
  visibilityLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: SURFACE_TOKENS.textSecondary,
  },
  visibilityLabelSelected: {
    fontWeight: '700',
    color: SURFACE_TOKENS.textPrimary,
  },
  visibilityHelper: {
    fontSize: 12,
    color: SURFACE_TOKENS.textSecondary,
    marginLeft: 24,
  },
});
