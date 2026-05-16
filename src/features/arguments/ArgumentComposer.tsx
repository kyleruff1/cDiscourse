import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { useArgumentComposer } from './useArgumentComposer';
import { useConstitution } from './useConstitution';
import { useAppSession } from '../session/useAppSession';
import { SUPABASE_CONFIGURED } from '../../lib/supabase';
import { submitArgumentDraft } from '../../lib/edgeFunctions';
import { deleteDraft } from '../session/sessionStorage';
import {
  buildSubmitArgumentPayload,
  createSubmissionFingerprint,
  getOrCreateClientSubmissionId,
  extractServerValidationError,
} from './composerSubmit';
import type { PendingSubmission } from '../session/types';
import { ComposerDraftRecoveryNotice } from './ComposerDraftRecoveryNotice';
import { ComposerTargetPanel } from './ComposerTargetPanel';
import { ComposerValidationPanel } from './ComposerValidationPanel';
import { getAllowedArgumentTypesForParent, getTagDefsForArgumentType } from './composerHelpers';
import { buildEvaluationInput } from './composerValidation';
import type { ArgumentRow, ArgumentType, ArgumentSide, DisagreementAxis } from './types';
import type { Debate } from '../debates/types';
import { evaluateArgumentDraft } from '../../domain/constitution';
import { Button } from '../../components/Button';
import { LoadingNotice } from '../../components/LoadingNotice';

interface Props {
  debate: Debate;
  selectedParentId: string | null;
  parentArgument: ArgumentRow | null;
  onClearParent: () => void;
  onSubmitSuccess: () => void;
}

const TYPE_LABELS: Record<ArgumentType, string> = {
  thesis: 'Thesis',
  claim: 'Claim',
  rebuttal: 'Rebuttal',
  counter_rebuttal: 'Counter-Rebuttal',
  evidence: 'Evidence',
  clarification_request: 'Clarification',
  concession: 'Concession',
  synthesis: 'Synthesis',
};

const SIDES: { value: ArgumentSide; label: string }[] = [
  { value: 'affirmative', label: 'Affirmative' },
  { value: 'negative', label: 'Negative' },
  { value: 'neutral', label: 'Neutral' },
];

const DISAGREEMENT_AXES: { value: DisagreementAxis; label: string }[] = [
  { value: 'fact', label: 'Fact' },
  { value: 'definition', label: 'Definition' },
  { value: 'causal', label: 'Causal' },
  { value: 'value', label: 'Value' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'logic', label: 'Logic' },
  { value: 'scope', label: 'Scope' },
];

const MAX_BODY = 2000;

const NEEDS_AXIS: ArgumentType[] = ['rebuttal', 'counter_rebuttal'];

export function ArgumentComposer({ debate, selectedParentId, parentArgument, onClearParent, onSubmitSuccess }: Props) {
  const { draft, isRecovered, updateField, discardDraft } = useArgumentComposer(
    debate.id,
    selectedParentId,
  );
  const constitution = useConstitution();
  const { state, dispatch } = useAppSession();
  const userId = state.snapshot.userId;
  const pendingSubmission = state.snapshot.pendingSubmission;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[] | null>(null);

  // Keep draft parentId in sync when the reply target changes from outside.
  const prevSelectedParentIdRef = useRef(selectedParentId);
  useEffect(() => {
    if (prevSelectedParentIdRef.current !== selectedParentId) {
      prevSelectedParentIdRef.current = selectedParentId;
      updateField({ parentId: selectedParentId });
    }
  }, [selectedParentId, updateField]);

  const parentType = parentArgument?.argumentType ?? null;

  const allowedTypes = useMemo(
    () => getAllowedArgumentTypesForParent(parentType, constitution.activeRules),
    [parentType, constitution.activeRules],
  );

  const availableTags = useMemo(
    () =>
      draft?.argumentType
        ? getTagDefsForArgumentType(draft.argumentType, constitution.tagDefinitions)
        : [],
    [draft?.argumentType, constitution.tagDefinitions],
  );

  const evaluationResult = useMemo(() => {
    if (!draft) return null;
    const input = buildEvaluationInput(draft, debate, parentArgument, {
      activeConstitution: constitution.activeConstitution,
      activeRules: constitution.activeRules,
      tagDefinitions: constitution.tagDefinitions,
      flagDefinitions: constitution.flagDefinitions,
    });
    if (!input) return null;
    return evaluateArgumentDraft(input);
  }, [draft, debate, parentArgument, constitution]);

  const canSubmit =
    !!draft &&
    !isSubmitting &&
    SUPABASE_CONFIGURED &&
    !!draft.argumentType &&
    !!draft.side &&
    draft.body.trim().length > 0 &&
    (evaluationResult?.allowPost ?? false);

  const handleSubmit = async () => {
    if (!draft || !draft.argumentType || !draft.side) return;
    if (!evaluationResult?.allowPost || isSubmitting || !SUPABASE_CONFIGURED) return;

    const fingerprint = createSubmissionFingerprint(draft);
    const clientSubmissionId = getOrCreateClientSubmissionId(pendingSubmission, fingerprint);

    const submission: PendingSubmission = {
      clientSubmissionId,
      draftId: draft.draftId,
      debateId: draft.debateId,
      createdAt: new Date().toISOString(),
      status: 'queued',
      lastError: null,
      submissionFingerprint: fingerprint,
    };

    dispatch({ type: 'SUBMISSION_QUEUED', submission });
    dispatch({ type: 'SUBMISSION_STARTED', clientSubmissionId });
    setIsSubmitting(true);
    setServerErrors(null);

    const payload = buildSubmitArgumentPayload(draft, clientSubmissionId);
    const result = await submitArgumentDraft(payload);

    if (result.ok) {
      dispatch({ type: 'SUBMISSION_SUCCEEDED', clientSubmissionId });
      dispatch({ type: 'DRAFT_CLEARED' });
      if (userId) {
        void deleteDraft(userId, draft.draftId, draft.debateId);
      }
      onSubmitSuccess();
    } else {
      const errorMsg = extractServerValidationError(result.error);
      dispatch({ type: 'SUBMISSION_FAILED', clientSubmissionId, error: errorMsg });
      setIsSubmitting(false);
      if (result.error.blockingErrors && result.error.blockingErrors.length > 0) {
        setServerErrors(result.error.blockingErrors.map((e) => e.message));
      } else {
        setServerErrors([errorMsg]);
      }
    }
  };

  if (!draft) {
    return <LoadingNotice message="Initializing draft…" />;
  }

  const showAxisPicker =
    draft.argumentType !== null && NEEDS_AXIS.includes(draft.argumentType);

  const disagreementAxisTags = availableTags.filter((td) => td.category === 'disagreement_axis');
  const generalTags = availableTags.filter((td) => td.category !== 'disagreement_axis');

  // Derive evidence fields from first item (or empty).
  const evidenceItem = draft.attachedEvidence[0] ?? { url: '', label: '', sourceText: '' };
  const updateEvidence = (patch: Partial<typeof evidenceItem>) => {
    const next = { ...evidenceItem, ...patch };
    const hasContent =
      (next.url ?? '').trim() || (next.label ?? '').trim() || (next.sourceText ?? '').trim();
    updateField({ attachedEvidence: hasContent ? [next] : [] });
  };

  const handleTypeSelect = (type: ArgumentType) => {
    const validTagsForNewType = getTagDefsForArgumentType(type, constitution.tagDefinitions).map(
      (td) => td.code,
    );
    const filteredTags = draft.selectedTagCodes.filter((c) => validTagsForNewType.includes(c));
    const clearAxis = !NEEDS_AXIS.includes(type) ? { disagreementAxis: null } : {};
    updateField({ argumentType: type, selectedTagCodes: filteredTags, ...clearAxis });
  };

  const handleSideSelect = (side: ArgumentSide) => updateField({ side });

  const handleBodyChange = (body: string) => updateField({ body });

  const handleTagToggle = (tagCode: string) => {
    const current = draft.selectedTagCodes;
    const next = current.includes(tagCode)
      ? current.filter((c) => c !== tagCode)
      : [...current, tagCode];
    updateField({ selectedTagCodes: next });
  };

  const handleAxisSelect = (axis: DisagreementAxis) => {
    updateField({ disagreementAxis: draft.disagreementAxis === axis ? null : axis });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Compose</Text>
        <Pressable
          onPress={discardDraft}
          accessibilityRole="button"
          accessibilityLabel="Discard draft"
        >
          <Text style={styles.discardText}>Discard</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Debate context */}
        <View style={styles.resolutionBar}>
          <Text style={styles.resolutionLabel}>Resolution</Text>
          <Text style={styles.resolutionText} numberOfLines={2}>
            {debate.resolution}
          </Text>
        </View>

        {isRecovered && (
          <ComposerDraftRecoveryNotice
            draftBody={draft.body}
            onResume={() => {}}
            onDiscard={discardDraft}
          />
        )}

        {/* Target / parent panel — always shown */}
        <ComposerTargetPanel
          parentArgument={parentArgument}
          selectedArgumentType={draft.argumentType}
          targetExcerpt={draft.targetExcerpt ?? ''}
          onChangeTargetExcerpt={(text) => updateField({ targetExcerpt: text || null })}
          onClear={parentArgument ? onClearParent : undefined}
        />

        {/* Type picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Argument type</Text>
          <View style={styles.chipRow}>
            {allowedTypes.map((type) => {
              const isSelected = draft.argumentType === type;
              return (
                <Pressable
                  key={type}
                  style={[styles.typeChip, isSelected && styles.typeChipSelected]}
                  onPress={() => handleTypeSelect(type)}
                  accessibilityRole="button"
                  accessibilityLabel={TYPE_LABELS[type]}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[styles.typeChipText, isSelected && styles.typeChipTextSelected]}>
                    {TYPE_LABELS[type]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Side picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Side</Text>
          <View style={styles.sideRow}>
            {SIDES.map(({ value, label }) => {
              const isSelected = draft.side === value;
              return (
                <Pressable
                  key={value}
                  style={[styles.sideChip, isSelected && styles.sideChipSelected]}
                  onPress={() => handleSideSelect(value)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[styles.sideChipText, isSelected && styles.sideChipTextSelected]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Body input */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionLabel}>Body</Text>
            <Text style={[styles.charCount, draft.body.length > MAX_BODY && styles.charCountOver]}>
              {draft.body.length}/{MAX_BODY}
            </Text>
          </View>
          <TextInput
            value={draft.body}
            onChangeText={handleBodyChange}
            placeholder="Write your argument here…"
            placeholderTextColor="#9ca3af"
            multiline
            style={styles.bodyInput}
            accessibilityLabel="Argument body"
            autoCapitalize="sentences"
          />
        </View>

        {/* Disagreement axis picker (rebuttal / counter_rebuttal) */}
        {showAxisPicker && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Disagreement axis{' '}
              <Text style={styles.required}>required</Text>
            </Text>
            <Text style={styles.sectionHint}>
              Identify the nature of your disagreement to satisfy C-RAIL-002.
            </Text>
            <View style={styles.chipRow}>
              {DISAGREEMENT_AXES.map(({ value, label }) => {
                const isSelected = draft.disagreementAxis === value;
                return (
                  <Pressable
                    key={value}
                    style={[styles.axisChip, isSelected && styles.axisChipSelected]}
                    onPress={() => handleAxisSelect(value)}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={[styles.axisChipText, isSelected && styles.axisChipTextSelected]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* General tags */}
        {generalTags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Tags</Text>
            <View style={styles.chipRow}>
              {generalTags.map((td) => {
                const isSelected = draft.selectedTagCodes.includes(td.code);
                return (
                  <Pressable
                    key={td.code}
                    style={[styles.tagChip, isSelected && styles.tagChipSelected]}
                    onPress={() => handleTagToggle(td.code)}
                    accessibilityRole="checkbox"
                    accessibilityLabel={td.label}
                    accessibilityState={{ checked: isSelected }}
                  >
                    <Text style={[styles.tagChipText, isSelected && styles.tagChipTextSelected]}>
                      {td.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Axis tags (secondary tag layer for rebuttals) */}
        {disagreementAxisTags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Disagreement tags</Text>
            <Text style={styles.sectionHint}>
              Optional additional tags. Use the axis selector above to satisfy the axis rail.
            </Text>
            <View style={styles.chipRow}>
              {disagreementAxisTags.map((td) => {
                const isSelected = draft.selectedTagCodes.includes(td.code);
                return (
                  <Pressable
                    key={td.code}
                    style={[styles.tagChip, styles.axisTagChip, isSelected && styles.axisTagChipSelected]}
                    onPress={() => handleTagToggle(td.code)}
                    accessibilityRole="checkbox"
                    accessibilityLabel={td.label}
                    accessibilityState={{ checked: isSelected }}
                  >
                    <Text style={[styles.tagChipText, isSelected && styles.axisTagChipTextSelected]}>
                      {td.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Evidence section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            Source / evidence
            {draft.argumentType === 'evidence' && (
              <Text style={styles.required}> required</Text>
            )}
          </Text>
          <Text style={styles.sectionHint}>
            Attach a URL, citation label, or source text. Required for evidence arguments.
          </Text>
          <TextInput
            value={evidenceItem.url ?? ''}
            onChangeText={(text) => updateEvidence({ url: text })}
            placeholder="URL (optional)"
            placeholderTextColor="#9ca3af"
            style={styles.evidenceInput}
            accessibilityLabel="Evidence URL"
            autoCapitalize="none"
            keyboardType="url"
          />
          <TextInput
            value={evidenceItem.label ?? ''}
            onChangeText={(text) => updateEvidence({ label: text })}
            placeholder="Citation label (optional)"
            placeholderTextColor="#9ca3af"
            style={styles.evidenceInput}
            accessibilityLabel="Evidence label"
            autoCapitalize="sentences"
          />
          <TextInput
            value={evidenceItem.sourceText ?? ''}
            onChangeText={(text) => updateEvidence({ sourceText: text })}
            placeholder="Source text or excerpt (optional)"
            placeholderTextColor="#9ca3af"
            multiline
            style={[styles.evidenceInput, styles.evidenceTextarea]}
            accessibilityLabel="Source text"
            autoCapitalize="sentences"
          />
        </View>

        {/* Validation preview */}
        {evaluationResult && (
          <ComposerValidationPanel result={evaluationResult} source={constitution.source} />
        )}

        {/* Server validation errors (422 from Edge Function) */}
        {serverErrors && serverErrors.length > 0 && (
          <View style={styles.serverErrorBox}>
            <Text style={styles.serverErrorTitle}>Server rejected this argument:</Text>
            {serverErrors.map((msg, i) => (
              <Text key={i} style={styles.serverErrorMsg}>
                {'•'} {msg}
              </Text>
            ))}
          </View>
        )}

        <Button
          label={isSubmitting ? 'Submitting…' : 'Submit Argument'}
          onPress={() => { void handleSubmit(); }}
          disabled={!canSubmit}
        />

        {!SUPABASE_CONFIGURED && (
          <Text style={styles.configWarning}>
            Supabase not configured — submit disabled.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  discardText: { fontSize: 13, color: '#ef4444', fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },
  resolutionBar: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  resolutionLabel: { fontSize: 10, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  resolutionText: { fontSize: 13, color: '#374151', lineHeight: 18 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  sectionHint: { fontSize: 11, color: '#6b7280', marginBottom: 8 },
  required: { fontSize: 11, fontWeight: '600', color: '#b91c1c' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  charCount: { fontSize: 12, color: '#9ca3af' },
  charCountOver: { color: '#ef4444' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  typeChipSelected: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  typeChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  typeChipTextSelected: { color: '#fff' },
  sideRow: { flexDirection: 'row', gap: 10 },
  sideChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  sideChipSelected: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  sideChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  sideChipTextSelected: { color: '#fff' },
  bodyInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
    minHeight: 140,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  axisChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c4b5fd',
    backgroundColor: '#faf5ff',
  },
  axisChipSelected: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  axisChipText: { fontSize: 12, fontWeight: '600', color: '#4c1d95' },
  axisChipTextSelected: { color: '#fff' },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  tagChipSelected: { backgroundColor: '#e0e7ff', borderColor: '#6366f1' },
  tagChipText: { fontSize: 12, fontWeight: '500', color: '#374151' },
  tagChipTextSelected: { color: '#4338ca' },
  axisTagChip: { borderColor: '#c4b5fd', backgroundColor: '#faf5ff' },
  axisTagChipSelected: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  axisTagChipTextSelected: { color: '#fff' },
  evidenceInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  evidenceTextarea: { minHeight: 60, textAlignVertical: 'top' },
  serverErrorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  serverErrorTitle: { fontSize: 13, fontWeight: '700', color: '#b91c1c', marginBottom: 6 },
  serverErrorMsg: { fontSize: 13, color: '#991b1b', lineHeight: 20, marginBottom: 2 },
  configWarning: { fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 6 },
});
