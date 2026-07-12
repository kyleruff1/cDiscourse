import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { KeyboardTypeOptions, TextInputProps } from 'react-native';
import { SURFACE_TOKENS, STATUS } from '../lib/designTokens';

interface TextInputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  keyboardType?: KeyboardTypeOptions;
  errorMessage?: string;
  editable?: boolean;
}

export function TextInputField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  autoCapitalize = 'sentences',
  keyboardType = 'default',
  errorMessage,
  editable = true,
}: TextInputFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={SURFACE_TOKENS.placeholder}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        editable={editable}
        style={[styles.input, !editable && styles.inputDisabled, errorMessage ? styles.inputError : null]}
        accessibilityLabel={label}
      />
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: SURFACE_TOKENS.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: SURFACE_TOKENS.textPrimary,
    backgroundColor: SURFACE_TOKENS.inputBg,
    minHeight: 44,
  },
  inputDisabled: { backgroundColor: SURFACE_TOKENS.base, color: SURFACE_TOKENS.textMuted },
  inputError: { borderColor: STATUS.danger.fg },
  error: { fontSize: 12, color: STATUS.danger.fg, marginTop: 4 },
});
