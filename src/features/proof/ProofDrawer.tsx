/**
 * PROOF-002 (#889) — ProofDrawer.
 *
 * The source drawer: a bottom sheet under 720px / a right panel at 720px+
 * (reusing the dock breakpoint from ObserverActionDockLayout — the single source
 * of truth, imported not re-derived). A 6-kind grid, one focused input per kind,
 * one Attach action that goes through the injected wrapper (never a direct write,
 * never the service role). Attaching never blocks a reply; a failure shows an
 * inline retry, never a modal.
 *
 * The drawer imports NO featureFlags (App is the sole flag consumer; the mount
 * decision + the wrapper arrive as props). Copy comes from the ban-list-clean
 * PROOF_DRAWER_COPY; the chip copy comes from ReceiptChip. Comments are
 * apostrophe-free for scanner safety.
 */
import React, { useCallback, useMemo, useState, type ReactElement } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RADIUS, SPACING, SURFACE_TOKENS, CONTROL, TOUCH_TARGET } from '../../lib/designTokens';
import {
  resolveObserverDockVariant,
  resolveSheetMaxHeightPx,
  type DockLayoutVariant,
} from '../arguments/ObserverActionDockLayout';
import { PROOF_DRAWER_COPY } from './proofDrawerCopy';
import {
  PROOF_DRAWER_KINDS,
  buildProofKindTiles,
  isProofDraftPostable,
  proofItemRowToEvidenceArtifact,
  type ProofDrawerKind,
  type ProofDrawerScope,
  type ProofDraftInput,
  type ProofItemRow,
} from './proofDrawerModel';
import type { AttachProofInput, AttachProofResult, DetachProofInput } from './attachProofApi';
import { ProofChip } from './ProofChip';

export interface ProofDrawerProps {
  scope: ProofDrawerScope;
  windowWidth: number;
  windowHeight?: number;
  reduceMotion?: boolean;
  currentUserId?: string | null;
  /** The move's already-attached sources (proofItemsByMessageId[argumentId]). */
  existingSources?: ReadonlyArray<ProofItemRow>;
  /** Candidate earlier moves for the prior_move picker. */
  priorMoves?: ReadonlyArray<{ id: string; label: string }>;
  /** The attach wrapper (attachProofApi.attachProof). Wired by App. */
  onAttach: (input: AttachProofInput) => Promise<AttachProofResult>;
  /** The detach wrapper. When absent, own sources show no detach affordance. */
  onDetach?: (input: DetachProofInput) => Promise<AttachProofResult>;
  onClose: () => void;
  /** Idempotency-carrier generator (overridable for deterministic tests). */
  generateClientAttachId?: () => string;
}

function defaultClientAttachId(): string {
  return `attach-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyDraft(kind: ProofDrawerKind): ProofDraftInput {
  return { kind, label: '' };
}

export function ProofDrawer({
  scope,
  windowWidth,
  windowHeight,
  reduceMotion,
  currentUserId,
  existingSources,
  priorMoves,
  onAttach,
  onDetach,
  onClose,
  generateClientAttachId,
}: ProofDrawerProps): ReactElement {
  const variant: DockLayoutVariant = resolveObserverDockVariant(windowWidth);
  const sheetMaxHeight = resolveSheetMaxHeightPx(windowHeight ?? 0);

  const debateId = scope.debateId;
  const argumentId = scope.argumentId;
  const owedDebtKind = scope.kind === 'argument' ? scope.owedDebtKind ?? null : null;

  const [selectedKind, setSelectedKind] = useState<ProofDrawerKind | null>(null);
  const [draft, setDraft] = useState<ProofDraftInput | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attachedRows, setAttachedRows] = useState<ProofItemRow[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const tiles = useMemo(() => buildProofKindTiles(PROOF_DRAWER_COPY), []);

  const allSources = useMemo<ProofItemRow[]>(
    () => [...(existingSources ?? []), ...attachedRows],
    [existingSources, attachedRows],
  );

  const selectKind = useCallback((kind: ProofDrawerKind) => {
    setSelectedKind(kind);
    setDraft(emptyDraft(kind));
    setErrorMessage(null);
  }, []);

  const backToGrid = useCallback(() => {
    setSelectedKind(null);
    setDraft(null);
    setErrorMessage(null);
  }, []);

  const canAttach = draft !== null && isProofDraftPostable(draft) && argumentId !== null && !submitting;

  const handleAttach = useCallback(async () => {
    if (!draft || argumentId === null) return;
    setSubmitting(true);
    setErrorMessage(null);
    const input: AttachProofInput = {
      debateId,
      argumentId,
      kind: draft.kind,
      label: draft.label,
      answersDebtKind: owedDebtKind,
      clientAttachId: (generateClientAttachId ?? defaultClientAttachId)(),
    };
    if (draft.url !== undefined) input.url = draft.url;
    if (draft.sourceText !== undefined) input.sourceText = draft.sourceText;
    if (draft.quote !== undefined) input.quote = draft.quote;
    if (draft.referencedArgumentId !== undefined) input.referencedArgumentId = draft.referencedArgumentId;

    const result = await onAttach(input);
    setSubmitting(false);
    if (result.ok && result.proofItem) {
      setAttachedRows((prev) => [...prev, result.proofItem as ProofItemRow]);
      backToGrid();
    } else {
      setErrorMessage(result.errorMessage ?? PROOF_DRAWER_COPY.errorFallback);
    }
  }, [draft, argumentId, debateId, owedDebtKind, generateClientAttachId, onAttach, backToGrid]);

  const handleDetach = useCallback(
    async (row: ProofItemRow) => {
      if (!onDetach) return;
      const result = await onDetach({ debateId, proofItemId: row.id });
      if (result.ok) {
        setAttachedRows((prev) => prev.filter((r) => r.id !== row.id));
      } else {
        setErrorMessage(result.errorMessage ?? PROOF_DRAWER_COPY.errorFallback);
      }
    },
    [onDetach, debateId],
  );

  const containerStyle = [
    styles.container,
    variant === 'sheet' ? { maxHeight: sheetMaxHeight, alignSelf: 'stretch' as const } : styles.sidePanel,
  ];

  return (
    <View style={containerStyle} testID="proof-drawer" accessibilityLabel={PROOF_DRAWER_COPY.drawerA11yLabel}>
      {/* Variant marker (test-inspectable; the dock breakpoint is the authority). */}
      <View testID={`proof-drawer-${variant}`} style={styles.header}>
        <Text style={styles.title}>{PROOF_DRAWER_COPY.title}</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={PROOF_DRAWER_COPY.closeA11yLabel}
          hitSlop={TOUCH_TARGET.hitSlopAll}
          style={styles.closeButton}
          testID="proof-drawer-close"
        >
          <Text style={styles.closeGlyph}>{'✕'}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        {/* Already-attached sources. */}
        {allSources.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>{PROOF_DRAWER_COPY.attachedHeader}</Text>
            {allSources.map((row) => {
              const isOwn = !!currentUserId && row.added_by === currentUserId;
              return (
                <View key={row.id} style={styles.chipRow} testID={`proof-drawer-chip-${row.id}`}>
                  <ProofChip
                    artifacts={[proofItemRowToEvidenceArtifact(row)]}
                    argumentId={row.argument_id}
                    testIDSuffix={row.id}
                    reduceMotion={reduceMotion}
                    isOwnMessage={isOwn}
                  />
                  {isOwn && onDetach ? (
                    <Pressable
                      onPress={() => void handleDetach(row)}
                      accessibilityRole="button"
                      accessibilityLabel={PROOF_DRAWER_COPY.detachLabel}
                      hitSlop={TOUCH_TARGET.hitSlopAll}
                      style={styles.detachButton}
                      testID={`proof-drawer-detach-${row.id}`}
                    >
                      <Text style={styles.detachGlyph}>{'🗑'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {selectedKind === null ? (
          <View style={styles.section}>
            <Text style={styles.gridIntro}>{PROOF_DRAWER_COPY.gridIntro}</Text>
            <View style={styles.grid}>
              {tiles.map((tile) => (
                <Pressable
                  key={tile.kind}
                  onPress={() => selectKind(tile.kind)}
                  accessibilityRole="button"
                  accessibilityLabel={tile.label}
                  accessibilityHint={tile.helper}
                  style={styles.tile}
                  testID={`proof-drawer-kind-${tile.kind}`}
                >
                  <Text style={styles.tileGlyph}>{tile.glyph}</Text>
                  <Text style={styles.tileLabel} numberOfLines={1}>
                    {tile.label}
                  </Text>
                  <Text style={styles.tileHelper} numberOfLines={2}>
                    {tile.helper}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FocusedInput
            kind={selectedKind}
            draft={draft as ProofDraftInput}
            priorMoves={priorMoves}
            argumentId={argumentId}
            submitting={submitting}
            canAttach={canAttach}
            onChange={setDraft}
            onAttach={() => void handleAttach()}
            onBack={backToGrid}
          />
        )}

        {errorMessage ? (
          <View style={styles.errorRow} accessibilityLiveRegion="polite" testID="proof-drawer-error">
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={PROOF_DRAWER_COPY.doneButton}
          style={styles.doneButton}
          testID="proof-drawer-done"
        >
          <Text style={styles.doneLabel}>{PROOF_DRAWER_COPY.doneButton}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ── focused input for a chosen kind ─────────────────────────────
interface FocusedInputProps {
  kind: ProofDrawerKind;
  draft: ProofDraftInput;
  priorMoves?: ReadonlyArray<{ id: string; label: string }>;
  argumentId: string | null;
  submitting: boolean;
  canAttach: boolean;
  onChange: (draft: ProofDraftInput) => void;
  onAttach: () => void;
  onBack: () => void;
}

function FocusedInput({
  kind,
  draft,
  priorMoves,
  argumentId,
  submitting,
  canAttach,
  onChange,
  onAttach,
  onBack,
}: FocusedInputProps): ReactElement {
  const label = PROOF_DRAWER_COPY.kindLabel[kind];
  const placeholder = PROOF_DRAWER_COPY.kindPlaceholder[kind];
  const patch = (p: Partial<ProofDraftInput>) => onChange({ ...draft, ...p });

  return (
    <View style={styles.section}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={`Back to source kinds — currently ${label}`}
        hitSlop={TOUCH_TARGET.hitSlopAll}
        style={styles.backRow}
        testID="proof-drawer-back"
      >
        <Text style={styles.backText}>{`‹ ${label}`}</Text>
      </Pressable>

      {kind === 'prior_move' ? (
        <View style={styles.priorList}>
          {(priorMoves ?? []).map((m) => {
            const selected = draft.referencedArgumentId === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => patch({ referencedArgumentId: m.id, label: draft.label || m.label })}
                accessibilityRole="button"
                accessibilityLabel={m.label}
                accessibilityState={{ selected }}
                style={[styles.priorItem, selected && styles.priorItemSelected]}
                testID={`proof-drawer-prior-${m.id}`}
              >
                {/* A11Y-693 — the selected prior-move carries a non-color signal
                    (a check affix + a thicker border) so selection reads in
                    grayscale. The affix stays visual-only; the screen reader
                    hears the selected state via accessibilityState above. */}
                <Text style={styles.priorItemText} numberOfLines={2}>
                  {selected ? `✓ ${m.label}` : m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <TextInput
          value={
            kind === 'url' || kind === 'external_ref'
              ? draft.url ?? ''
              : kind === 'quote'
                ? draft.quote ?? ''
                : draft.sourceText ?? ''
          }
          onChangeText={(text) => {
            if (kind === 'url' || kind === 'external_ref') patch({ url: text });
            else if (kind === 'quote') patch({ quote: text });
            else patch({ sourceText: text });
          }}
          placeholder={placeholder}
          placeholderTextColor={SURFACE_TOKENS.placeholder}
          accessibilityLabel={`${label} input`}
          multiline={kind === 'quote' || kind === 'source_text'}
          keyboardType={kind === 'url' || kind === 'external_ref' ? 'url' : 'default'}
          autoCapitalize={kind === 'url' || kind === 'external_ref' ? 'none' : 'sentences'}
          style={[styles.input, (kind === 'quote' || kind === 'source_text') && styles.inputMultiline]}
          testID="proof-drawer-input"
        />
      )}

      {/* Optional editable label (<= 120). */}
      <TextInput
        value={draft.label}
        onChangeText={(text) => patch({ label: text.slice(0, 120) })}
        placeholder={'Label (optional)'}
        placeholderTextColor={SURFACE_TOKENS.placeholder}
        accessibilityLabel={'Source label'}
        maxLength={120}
        style={styles.input}
        testID="proof-drawer-label-input"
      />

      {argumentId === null ? (
        <Text style={styles.hint} testID="proof-drawer-draft-hint">
          {'Post your reply first, then add a source to it.'}
        </Text>
      ) : null}

      <Pressable
        onPress={onAttach}
        disabled={!canAttach}
        accessibilityRole="button"
        accessibilityLabel={PROOF_DRAWER_COPY.attachButton}
        accessibilityState={{ disabled: !canAttach, busy: submitting }}
        style={[styles.attachButton, !canAttach && styles.attachDisabled]}
        testID="proof-drawer-attach"
      >
        <Text style={styles.attachLabel}>{PROOF_DRAWER_COPY.attachButton}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SURFACE_TOKENS.raised,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    width: '100%',
  },
  sidePanel: {
    maxWidth: 420,
    alignSelf: 'flex-end',
    borderRadius: RADIUS.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_TOKENS.border,
  },
  title: { color: SURFACE_TOKENS.textPrimary, fontSize: 16, fontWeight: '700' },
  closeButton: {
    minWidth: TOUCH_TARGET.minSizePx,
    minHeight: TOUCH_TARGET.minSizePx,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { color: SURFACE_TOKENS.textSecondary, fontSize: 16 },
  body: { paddingHorizontal: SPACING.l, paddingVertical: SPACING.m },
  section: { gap: SPACING.s, marginBottom: SPACING.m },
  sectionHeader: { color: SURFACE_TOKENS.textSecondary, fontSize: 12, fontWeight: '700' },
  gridIntro: { color: SURFACE_TOKENS.textPrimary, fontSize: 14, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.s },
  tile: {
    minWidth: TOUCH_TARGET.minSizePx,
    minHeight: TOUCH_TARGET.minSizePx,
    flexBasis: '30%',
    flexGrow: 1,
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.s,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: CONTROL.secondary.borderColor,
    backgroundColor: CONTROL.secondary.bg,
    gap: 2,
  },
  tileGlyph: { color: SURFACE_TOKENS.textPrimary, fontSize: 18 },
  tileLabel: { color: SURFACE_TOKENS.textPrimary, fontSize: 13, fontWeight: '700' },
  tileHelper: { color: SURFACE_TOKENS.textSecondary, fontSize: 11 },
  backRow: { minHeight: TOUCH_TARGET.minSizePx, justifyContent: 'center' },
  backText: { color: SURFACE_TOKENS.textSecondary, fontSize: 13, fontWeight: '600' },
  priorList: { gap: SPACING.xs },
  priorItem: {
    minHeight: TOUCH_TARGET.minSizePx,
    justifyContent: 'center',
    paddingHorizontal: SPACING.m,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
  },
  // A11Y-693 — thicker border pairs with the check affix so selection is not
  // color-alone (grayscale-legible; mirrors the BooleanFeedbackBar marked style).
  priorItemSelected: { borderColor: CONTROL.primary.bg, borderWidth: 2 },
  priorItemText: { color: SURFACE_TOKENS.textPrimary, fontSize: 13 },
  input: {
    minHeight: TOUCH_TARGET.minSizePx,
    backgroundColor: SURFACE_TOKENS.inputBg,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    color: SURFACE_TOKENS.textPrimary,
    fontSize: 14,
  },
  inputMultiline: { minHeight: 88, maxHeight: 160, textAlignVertical: 'top' },
  hint: { color: SURFACE_TOKENS.textMuted, fontSize: 12 },
  attachButton: {
    minHeight: TOUCH_TARGET.minSizePx,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: CONTROL.primary.bg,
    marginTop: SPACING.s,
  },
  attachDisabled: { backgroundColor: CONTROL.primary.disabledBg, opacity: 0.6 },
  attachLabel: { color: CONTROL.primary.fg, fontSize: 15, fontWeight: '700' },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.s },
  detachButton: {
    minWidth: TOUCH_TARGET.minSizePx,
    minHeight: TOUCH_TARGET.minSizePx,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detachGlyph: { color: SURFACE_TOKENS.textSecondary, fontSize: 14 },
  errorRow: { paddingVertical: SPACING.s },
  errorText: { color: CONTROL.danger.fg, fontSize: 13 },
  doneButton: {
    minHeight: TOUCH_TARGET.minSizePx,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.s,
    marginBottom: SPACING.l,
  },
  doneLabel: { color: SURFACE_TOKENS.textSecondary, fontSize: 14, fontWeight: '600' },
});

/** Re-export the kind list for callers that render a grid preview. */
export { PROOF_DRAWER_KINDS };
