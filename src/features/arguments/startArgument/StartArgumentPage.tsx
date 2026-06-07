/**
 * NAV-START-ARGUMENT-001 Slice A — Start Argument page.
 *
 * Replaces the old `CreateDebateForm` ("New Argument") surface. Declaration-
 * first: a single required claim/question/position is the visual focus. A
 * Timeline / Card surface selector chooses the LANDING VIEW after creation
 * (same underlying record either way). Three OPTIONAL taxonomy selectors
 * (argument type, disagreement strategy, disagreement cause) sit secondary
 * to the declaration.
 *
 * Doctrine boundary:
 *   - The taxonomy selections are SELF-DECLARED FRAMING METADATA the author
 *     chooses about their OWN move. They are not a machine classification,
 *     not a validity / verdict judgment, and never gate submission.
 *   - Submit uses the EXISTING creation path (`onCreate` → the same
 *     `useDebates().create` → `createDebate` the old New Argument used).
 *   - NO classifier / AI / MCP call sits anywhere in the submit/acceptance
 *     path. The Constitution rules engine remains the sole submission gate.
 *
 * Styling: dark surfaces only (`SURFACE_TOKENS`), no reuse of the old New
 * Argument bright-white container/classes. The declaration is the focus;
 * taxonomy is visually secondary. >= 44px tap targets; visible focus +
 * selection states that do not rely on color alone (a ● / ○ glyph + bolder
 * label carry the selection).
 */
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SURFACE_TOKENS, CONTROL, SPACING, RADIUS, TOUCH_TARGET } from '../../../lib/designTokens';
import { pickDisplayTitle } from '../../debates/debateTitleHelpers';
import type { CreateDebateInput, Debate } from '../../debates/types';
import {
  ARGUMENT_SCHEME_OPTIONS,
  DISAGREEMENT_CAUSE_OPTIONS,
  groupDisagreementStrategiesByCluster,
  isStartArgumentDraftSubmittable,
  type ArgumentSchemeId,
  type DisagreementCauseId,
  type DisagreementStrategyId,
  type StartArgumentSurface,
} from './startArgumentTaxonomy';

// ── Copy ──────────────────────────────────────────────────────────
// All user-facing copy lives here so the ban-list test can scan one
// place. Neutral, non-verdict. States the taxonomy is self-declared
// framing, not a machine classification or a validity judgment.

const COPY = {
  screenTitle: 'Start an argument',
  declarationLabel: 'Declaration',
  declarationHelper: 'State the claim, question, or position you want to examine.',
  declarationPlaceholder: 'What do you want to put forward?',
  surfaceSectionLabel: 'Open into',
  surfaceSectionHelper: 'Choose the view you land in. It is the same argument either way.',
  surfaceTimelineLabel: 'Timeline',
  surfaceTimelineHelper: 'Timeline — follow the sequence of replies and turns.',
  surfaceCardLabel: 'Card',
  surfaceCardHelper: 'Card — open a focused argument card with details readily visible.',
  taxonomySectionLabel: 'Optional framing',
  taxonomyDisclaimer:
    'Optional. These are your own framing notes about how you mean this argument — not a classification of it and not a judgment of whether it is right.',
  schemeLabel: 'Argument type',
  schemeHelper: 'Optional — how you mean to reason here.',
  strategyLabel: 'Disagreement strategy',
  strategyHelper: 'Optional — the discussion style you expect to use.',
  causeLabel: 'Why might people disagree here?',
  causeHelper: 'Optional — where you think the disagreement comes from.',
  submitLabel: 'Start argument',
  cancelLabel: 'Cancel',
  submitError: 'Could not start the argument. Please try again.',
} as const;

// ── Props ─────────────────────────────────────────────────────────

interface StartArgumentPageProps {
  /**
   * The EXISTING creation path — the same `useDebates().create` →
   * `createDebate` the old New Argument surface used. The page does NOT
   * invent a new creation channel.
   */
  onCreate: (input: CreateDebateInput) => Promise<Debate | null>;
  /**
   * Landing-route hand-off. Called after a successful create with the
   * created debate and the chosen surface, so the caller can open the room
   * into the matching view (timeline → Timeline view; card → Cards view).
   * Optional — callers that only need the room created can omit it.
   */
  onCreated?: (debate: Debate, surface: StartArgumentSurface) => void;
  /** Dismiss without creating. */
  onCancel: () => void;
}

// ── Component ─────────────────────────────────────────────────────

export function StartArgumentPage({ onCreate, onCreated, onCancel }: StartArgumentPageProps) {
  const [declaration, setDeclaration] = useState('');
  const [surface, setSurface] = useState<StartArgumentSurface>('timeline');
  const [argumentScheme, setArgumentScheme] = useState<ArgumentSchemeId>('unspecified');
  const [disagreementStrategy, setDisagreementStrategy] =
    useState<DisagreementStrategyId>('unspecified');
  const [disagreementCause, setDisagreementCause] =
    useState<DisagreementCauseId>('unspecified');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = isStartArgumentDraftSubmittable({ declaration }) && !submitting;

  const handleSubmit = async () => {
    if (!isStartArgumentDraftSubmittable({ declaration })) return;
    setSubmitting(true);
    setError(null);
    // The declaration is the proposition (resolution); a short title is
    // derived from it via the shared display-title helper (no body
    // mutation). `description` is left empty — the old form had it
    // optional and `createDebate` trims it safely.
    const trimmed = declaration.trim();
    const input: CreateDebateInput = {
      title: pickDisplayTitle({ rootBody: trimmed }),
      resolution: trimmed,
      description: '',
    };
    try {
      // NAV-START-ARGUMENT-001: the EXISTING creation path. No classifier,
      // no AI, no MCP, no semantic referee invoked here — the rules engine
      // (server-side, via the existing path) is the sole submission gate.
      const created = await onCreate(input);
      if (created) {
        onCreated?.(created, surface);
      } else {
        setError(COPY.submitError);
      }
    } catch {
      setError(COPY.submitError);
    }
    setSubmitting(false);
  };

  const strategyGroups = groupDisagreementStrategiesByCluster();

  return (
    <View style={styles.screen} testID="start-argument-page">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{COPY.screenTitle}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Declaration (the focus) ─────────────────────────── */}
        <View style={styles.declarationBlock}>
          <Text style={styles.declarationLabel}>{COPY.declarationLabel}</Text>
          <Text style={styles.helper}>{COPY.declarationHelper}</Text>
          <TextInput
            value={declaration}
            onChangeText={(v) => {
              setDeclaration(v);
              if (error) setError(null);
            }}
            placeholder={COPY.declarationPlaceholder}
            placeholderTextColor={SURFACE_TOKENS.placeholder}
            multiline
            textAlignVertical="top"
            style={styles.declarationInput}
            accessibilityLabel={COPY.declarationLabel}
            accessibilityHint={COPY.declarationHelper}
            testID="start-argument-declaration"
          />
        </View>

        {/* ── Surface selector (drives landing route) ─────────── */}
        <View style={styles.section} testID="start-argument-surface">
          <Text style={styles.sectionLabel}>{COPY.surfaceSectionLabel}</Text>
          <Text style={styles.helper}>{COPY.surfaceSectionHelper}</Text>
          <View
            style={styles.surfaceRow}
            accessibilityRole="radiogroup"
            accessibilityLabel={COPY.surfaceSectionLabel}
          >
            <SurfaceOption
              value="timeline"
              label={COPY.surfaceTimelineLabel}
              helper={COPY.surfaceTimelineHelper}
              selected={surface === 'timeline'}
              onSelect={setSurface}
              testID="start-argument-surface-timeline"
            />
            <SurfaceOption
              value="card"
              label={COPY.surfaceCardLabel}
              helper={COPY.surfaceCardHelper}
              selected={surface === 'card'}
              onSelect={setSurface}
              testID="start-argument-surface-card"
            />
          </View>
        </View>

        {/* ── Optional framing taxonomy (secondary) ───────────── */}
        <View style={styles.section} testID="start-argument-taxonomy">
          <Text style={styles.sectionLabel}>{COPY.taxonomySectionLabel}</Text>
          <Text style={styles.disclaimer}>{COPY.taxonomyDisclaimer}</Text>

          {/* Argument type */}
          <View style={styles.taxonomyGroup} testID="start-argument-scheme">
            <Text style={styles.taxonomyGroupLabel}>{COPY.schemeLabel}</Text>
            <Text style={styles.helper}>{COPY.schemeHelper}</Text>
            <View style={styles.optionWrap}>
              {ARGUMENT_SCHEME_OPTIONS.map((o) => (
                <TaxonomyChip
                  key={`scheme-${o.id}`}
                  label={o.label}
                  helper={o.description}
                  selected={argumentScheme === o.id}
                  onPress={() => setArgumentScheme(o.id)}
                  testID={`start-argument-scheme-${o.id}`}
                />
              ))}
            </View>
          </View>

          {/* Disagreement strategy — grouped by cluster */}
          <View style={styles.taxonomyGroup} testID="start-argument-strategy">
            <Text style={styles.taxonomyGroupLabel}>{COPY.strategyLabel}</Text>
            <Text style={styles.helper}>{COPY.strategyHelper}</Text>
            {strategyGroups.map((group) => (
              <View key={`cluster-${group.cluster}`} style={styles.clusterBlock}>
                <Text style={styles.clusterLabel}>{group.clusterLabel}</Text>
                <View style={styles.optionWrap}>
                  {group.options.map((o) => (
                    <TaxonomyChip
                      key={`strategy-${o.id}`}
                      label={o.label}
                      helper={o.description}
                      selected={disagreementStrategy === o.id}
                      onPress={() => setDisagreementStrategy(o.id)}
                      testID={`start-argument-strategy-${o.id}`}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>

          {/* Disagreement cause */}
          <View style={styles.taxonomyGroup} testID="start-argument-cause">
            <Text style={styles.taxonomyGroupLabel}>{COPY.causeLabel}</Text>
            <Text style={styles.helper}>{COPY.causeHelper}</Text>
            <View style={styles.optionWrap}>
              {DISAGREEMENT_CAUSE_OPTIONS.map((o) => (
                <TaxonomyChip
                  key={`cause-${o.id}`}
                  label={o.label}
                  helper={o.description}
                  selected={disagreementCause === o.id}
                  onPress={() => setDisagreementCause(o.id)}
                  testID={`start-argument-cause-${o.id}`}
                />
              ))}
            </View>
          </View>
        </View>

        {error ? (
          <Text
            style={styles.error}
            accessibilityLiveRegion="polite"
            testID="start-argument-error"
          >
            {error}
          </Text>
        ) : null}

        {/* ── Actions ─────────────────────────────────────────── */}
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel={COPY.submitLabel}
          accessibilityState={{ disabled: !canSubmit, busy: submitting }}
          style={({ pressed }) => [
            styles.submit,
            !canSubmit && styles.submitDisabled,
            pressed && canSubmit && styles.pressed,
          ]}
          testID="start-argument-submit"
        >
          <Text style={styles.submitLabel}>{COPY.submitLabel}</Text>
        </Pressable>

        <Pressable
          onPress={onCancel}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={COPY.cancelLabel}
          accessibilityState={{ disabled: submitting }}
          style={({ pressed }) => [
            styles.cancel,
            pressed && !submitting && styles.pressed,
          ]}
          testID="start-argument-cancel"
        >
          <Text style={styles.cancelLabel}>{COPY.cancelLabel}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ── Surface option (radio) ────────────────────────────────────────

function SurfaceOption({
  value,
  label,
  helper,
  selected,
  onSelect,
  testID,
}: {
  value: StartArgumentSurface;
  label: string;
  helper: string;
  selected: boolean;
  onSelect: (v: StartArgumentSurface) => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={() => onSelect(value)}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${helper}`}
      hitSlop={TOUCH_TARGET.hitSlopCompact}
      style={[styles.surfaceOption, selected && styles.surfaceOptionSelected]}
      testID={testID}
    >
      <View style={styles.surfaceOptionHeader}>
        {/* Shape glyph (●/○) + bolder label carry selection — not color alone. */}
        <Text style={[styles.surfaceCheck, selected && styles.surfaceCheckOn]}>
          {selected ? '●' : '○'}
        </Text>
        <Text style={[styles.surfaceLabel, selected && styles.surfaceLabelSelected]}>
          {label}
        </Text>
      </View>
      <Text style={styles.surfaceHelper}>{helper}</Text>
    </Pressable>
  );
}

// ── Taxonomy chip (single-select within a group) ──────────────────

function TaxonomyChip({
  label,
  helper,
  selected,
  onPress,
  testID,
}: {
  label: string;
  helper: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${helper}`}
      hitSlop={TOUCH_TARGET.hitSlopCompact}
      style={[styles.chip, selected && styles.chipSelected]}
      testID={testID}
    >
      {/* Shape glyph carries selection state in addition to color. */}
      <Text style={[styles.chipCheck, selected && styles.chipCheckOn]}>
        {selected ? '●' : '○'}
      </Text>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

// ── Styles (dark surfaces only) ───────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SURFACE_TOKENS.base },
  header: {
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.l,
    backgroundColor: SURFACE_TOKENS.raised,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_TOKENS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.l, paddingBottom: SPACING.xl * 2, gap: SPACING.l },

  // Declaration — the visual focus. Larger, elevated, generous.
  declarationBlock: {
    backgroundColor: SURFACE_TOKENS.elevated,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    padding: SPACING.l,
    gap: SPACING.xs,
  },
  declarationLabel: { fontSize: 16, fontWeight: '800', color: SURFACE_TOKENS.textPrimary },
  declarationInput: {
    marginTop: SPACING.s,
    minHeight: 120,
    backgroundColor: SURFACE_TOKENS.inputBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    fontSize: 16,
    lineHeight: 22,
    color: SURFACE_TOKENS.textPrimary,
  },

  // Secondary sections.
  section: { gap: SPACING.xs },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: SURFACE_TOKENS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  helper: { fontSize: 12, color: SURFACE_TOKENS.textSecondary, lineHeight: 16 },
  disclaimer: { fontSize: 12, color: SURFACE_TOKENS.textMuted, lineHeight: 16, fontStyle: 'italic' },

  // Surface selector.
  surfaceRow: { flexDirection: 'row', gap: SPACING.s, marginTop: SPACING.s },
  surfaceOption: {
    flex: 1,
    minHeight: 44,
    padding: SPACING.m,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    backgroundColor: SURFACE_TOKENS.elevated,
    gap: SPACING.xs,
  },
  surfaceOptionSelected: { borderWidth: 2, borderColor: SURFACE_TOKENS.focusRing },
  surfaceOptionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.s },
  surfaceCheck: { fontSize: 15, color: SURFACE_TOKENS.textMuted },
  surfaceCheckOn: { color: SURFACE_TOKENS.textPrimary },
  surfaceLabel: { fontSize: 14, fontWeight: '600', color: SURFACE_TOKENS.textSecondary },
  surfaceLabelSelected: { fontWeight: '800', color: SURFACE_TOKENS.textPrimary },
  surfaceHelper: { fontSize: 11, color: SURFACE_TOKENS.textMuted, lineHeight: 15 },

  // Taxonomy.
  taxonomyGroup: { marginTop: SPACING.m, gap: SPACING.xs },
  taxonomyGroupLabel: { fontSize: 14, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },
  clusterBlock: { marginTop: SPACING.s, gap: SPACING.xs },
  clusterLabel: { fontSize: 12, fontWeight: '700', color: SURFACE_TOKENS.textSecondary },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.s, marginTop: SPACING.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    minHeight: 44,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    backgroundColor: SURFACE_TOKENS.elevated,
  },
  chipSelected: { borderWidth: 2, borderColor: SURFACE_TOKENS.focusRing, backgroundColor: SURFACE_TOKENS.overlay },
  chipCheck: { fontSize: 13, color: SURFACE_TOKENS.textMuted },
  chipCheckOn: { color: SURFACE_TOKENS.textPrimary },
  chipText: { fontSize: 13, fontWeight: '600', color: SURFACE_TOKENS.textSecondary },
  chipTextSelected: { fontWeight: '800', color: SURFACE_TOKENS.textPrimary },

  // Error.
  error: { fontSize: 13, color: '#fca5a5', marginTop: SPACING.xs },

  // Actions.
  submit: {
    minHeight: 48,
    borderRadius: RADIUS.md,
    backgroundColor: CONTROL.primary.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.m,
  },
  submitDisabled: { backgroundColor: CONTROL.primary.disabledBg, opacity: 0.6 },
  submitLabel: { fontSize: 15, fontWeight: '700', color: CONTROL.primary.fg },
  cancel: {
    minHeight: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: CONTROL.secondary.borderColor,
    backgroundColor: CONTROL.secondary.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.s,
  },
  cancelLabel: { fontSize: 15, fontWeight: '600', color: CONTROL.secondary.fg },
  pressed: { opacity: 0.8 },
});
