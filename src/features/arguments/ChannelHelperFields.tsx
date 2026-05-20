/**
 * RULE-005 — ChannelHelperFields.
 *
 * The collapsed optional-field block for a selected channel. When a
 * channel's `optionalFields` is non-empty the dock shows an "Add details"
 * disclosure; expanding it renders one labelled `TextInput` per
 * `ChannelOptionalField`.
 *
 * Doctrine / accessibility (RULE-005 design §4.3 / §5.5 / §12):
 *  - The fields are ADVISORY in casual mode (v1 is always casual): leaving
 *    a field empty never blocks the post. GAME-003 owns required-vs-
 *    advisory strictness — the `mode` prop is the stable hook for it.
 *  - Every `TextInput` carries an `accessibilityLabel`.
 *  - A channel with empty `optionalFields` (e.g. `meta_process`,
 *    `concede`, `branch_tangent`) renders nothing — the disclosure is
 *    not shown (design §7 edge case 5).
 *
 * The field labels + placeholders are pure data extracted into a frozen
 * table so they are unit-testable without an RN renderer.
 */
import React, { type ReactElement } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { channelDefinition, type ChannelOptionalField, type MoveChannel } from './channelModel';
import type { ChannelSuggestionMode } from './channelModel';

export interface ChannelHelperFieldsProps {
  /** The currently-selected channel. */
  channel: MoveChannel;
  /** Current values, keyed by field id. */
  values: Partial<Record<ChannelOptionalField, string>>;
  /** Called when a field changes. */
  onChangeField: (field: ChannelOptionalField, value: string) => void;
  /** v1: always 'casual'. In casual mode every field is advisory. */
  mode: ChannelSuggestionMode;
}

/** Plain-language label + placeholder for each optional field. Frozen. */
export const CHANNEL_FIELD_COPY: Readonly<
  Record<ChannelOptionalField, { label: string; placeholder: string }>
> = Object.freeze({
  source_url: Object.freeze({
    label: 'Source link',
    placeholder: 'Paste a link to the source',
  }),
  quote_text: Object.freeze({
    label: 'Exact quote',
    placeholder: 'Paste the exact passage you mean',
  }),
  scope_example: Object.freeze({
    label: 'Scope example',
    placeholder: 'Name the specific case you mean',
  }),
  definition: Object.freeze({
    label: 'Definition',
    placeholder: 'How should this term be read?',
  }),
  mechanism: Object.freeze({
    label: 'Mechanism',
    placeholder: 'Describe the cause-and-effect step',
  }),
  counterexample: Object.freeze({
    label: 'Counterexample',
    placeholder: 'Give a case the claim does not cover',
  }),
  primary_source: Object.freeze({
    label: 'Primary source',
    placeholder: 'Name the original source, not a summary',
  }),
});

// ── Pure helpers (also consumed by tests) ─────────────────────

/** The optional fields a channel reveals. Empty array → render nothing. */
export function helperFieldsForChannel(
  channel: MoveChannel,
): ReadonlyArray<ChannelOptionalField> {
  return channelDefinition(channel).optionalFields;
}

/** True when the channel has at least one helper field to disclose. Pure. */
export function channelHasHelperFields(channel: MoveChannel): boolean {
  return helperFieldsForChannel(channel).length > 0;
}

/** The plain-language label for a field. Pure. */
export function getChannelFieldLabel(field: ChannelOptionalField): string {
  return CHANNEL_FIELD_COPY[field].label;
}

/**
 * In v1 every helper field is advisory — leaving one empty never blocks a
 * post. The `mode` parameter is the stable hook for GAME-003, which will
 * own any 'strict'-mode required-field behaviour; until then this always
 * returns false. Pure.
 */
export function isHelperFieldRequired(
  _field: ChannelOptionalField,
  _mode: ChannelSuggestionMode,
): boolean {
  // v1: every field is advisory regardless of mode. GAME-003 owns strict.
  return false;
}

// ── Component ──────────────────────────────────────────────────

export function ChannelHelperFields({
  channel,
  values,
  onChangeField,
  mode,
}: ChannelHelperFieldsProps): ReactElement | null {
  const fields = helperFieldsForChannel(channel);
  if (fields.length === 0) {
    // meta_process / concede / branch_tangent / etc. — nothing to show.
    return null;
  }

  return (
    <View style={styles.wrapper} testID="channel-helper-fields">
      {fields.map((field) => {
        const copy = CHANNEL_FIELD_COPY[field];
        const advisory = !isHelperFieldRequired(field, mode);
        return (
          <View key={field} style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>
              {copy.label}
              {advisory ? <Text style={styles.optionalHint}> (optional)</Text> : null}
            </Text>
            <TextInput
              value={values[field] ?? ''}
              onChangeText={(text) => onChangeField(field, text)}
              placeholder={copy.placeholder}
              placeholderTextColor="#94a3b8"
              accessibilityLabel={copy.label}
              style={styles.fieldInput}
              testID={`channel-helper-field-${field}`}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  fieldBlock: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  optionalHint: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
  },
  fieldInput: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
});
