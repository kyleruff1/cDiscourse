import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { STATUS } from '../lib/designTokens';

interface ErrorNoticeProps {
  message: string;
}

export function ErrorNotice({ message }: ErrorNoticeProps) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: STATUS.danger.bg,
    borderWidth: 1,
    borderColor: STATUS.danger.fg,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  message: { fontSize: 14, color: STATUS.danger.fg, lineHeight: 20 },
});
