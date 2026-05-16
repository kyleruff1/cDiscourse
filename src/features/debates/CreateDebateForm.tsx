import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { TextInputField } from '../../components/TextInputField';
import { Button } from '../../components/Button';
import { ErrorNotice } from '../../components/ErrorNotice';
import type { CreateDebateInput } from './types';

interface Props {
  onSubmit: (input: CreateDebateInput) => Promise<void>;
  onCancel: () => void;
}

export function CreateDebateForm({ onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState('');
  const [resolution, setResolution] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = title.trim().length > 0 && resolution.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ title: title.trim(), resolution: resolution.trim(), description: description.trim() });
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setSubmitting(false);
  };

  return (
    <Screen title="New Debate">
      <View style={styles.form}>
        <TextInputField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="A short label for this debate"
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
        {error ? <ErrorNotice message={error} /> : null}
        <Button
          label="Create Debate"
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
});
