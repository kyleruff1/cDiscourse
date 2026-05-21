/**
 * EV-002 — SourceChainPopover.
 *
 * Inline collapsible section anchored inside the existing
 * `TimelineNodePopover` body region. Renders the popover model's headline
 * + helper + the one primary CTA mapped from `SourceChainStatus`.
 *
 * Doctrine:
 *   - Never asserts truth. Every "ask" CTA is a question; every read-only
 *     affordance starts with "Inspect".
 *   - Never references engagement, virality, or "many people".
 *   - Hides every "ask" CTA when the viewer is the author of the message —
 *     authors fix their own trail by attaching a new evidence move, not by
 *     asking themselves.
 *   - Observer mode keeps the "ask" CTA visible but disabled with the
 *     helper "Join a side to ask" (locked at design handoff).
 *
 * Accessibility:
 *   - `accessibilityRole="dialog"` on the root.
 *   - Primary CTA `accessibilityRole="button"` + `accessibilityState`
 *     reflecting disabled-by-observer mode.
 *   - `reduceMotion === true` skips the `LayoutAnimation.configureNext`
 *     call on expand/collapse.
 *   - Color independence — text label carries the same info as the
 *     dotted-teal ring on the chip.
 */
import React, { useCallback, type ReactElement } from 'react';
import {
  LayoutAnimation,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  AnnotationDepthCapResult,
  EvidenceAnnotation,
  EvidenceAnnotationSummary,
  EvidenceArtifact,
} from './evidenceModel';
import type { SourceChainPopoverModel } from './sourceChainPopoverModel';
import { EvidenceAnnotationStream } from './EvidenceAnnotationChip';

export interface SourceChainPopoverProps {
  /** The pure-TS view-model. Built by buildSourceChainPopoverModel. */
  model: SourceChainPopoverModel;
  /**
   * The artifact list — read-only states render the first artifact's
   * label / host / quote. Pass `[]` for the `no_source` state.
   */
  artifacts: ReadonlyArray<EvidenceArtifact>;
  /**
   * Dispatch when the user confirms an "ask" action. Caller wires this
   * to the existing onAction(control, messageId) signature.
   */
  onAskAction?: (control: 'ask_for_source' | 'ask_for_quote', messageId: string) => void;
  /** The active message id this popover is bound to. */
  messageId: string;
  /** Whether the inline section is currently expanded (parent owns state). */
  isExpanded: boolean;
  /** Toggle expand/collapse. The parent TimelineNodePopover owns the state. */
  onToggleExpanded: () => void;
  /**
   * True when the viewer cannot post (observer mode). When true, the "ask"
   * primary action is rendered DISABLED with a helper "Join a side to ask".
   */
  isReadModeViewer?: boolean;
  /**
   * True when the viewer is the author of this message. When true, the
   * popover hides every "ask" CTA and shows an "Inspect receipt" affordance
   * only — even in invitesFollowup states. (Authors don't ask themselves.)
   */
  isOwnMessage?: boolean;
  /**
   * True when AccessibilityInfo.isReduceMotionEnabled is true. Disables the
   * expand/collapse animation.
   */
  reduceMotion?: boolean;
  /**
   * EV-005 — Annotations on the first artifact in this popover. When
   * non-empty (or when `canAddAnnotation` is true) the expanded popover
   * renders the EvidenceAnnotationStream below the artifact rows. Defaults
   * to `[]` — when omitted the popover renders exactly as EV-002 does today.
   */
  annotations?: ReadonlyArray<EvidenceAnnotation>;
  /** EV-005 — derived annotation summary for the status-chip header. */
  annotationSummary?: EvidenceAnnotationSummary;
  /** EV-005 — depth-cap partition for the annotation stream. */
  annotationDepthCap?: AnnotationDepthCapResult;
  /**
   * EV-005 — true when the viewer is eligible to add a depth-0 annotation.
   * When true the "Add an annotation" trigger renders (even with no existing
   * annotations — you can add the first). Defaults to false.
   */
  canAddAnnotation?: boolean;
  /** EV-005 — fires when the "Add an annotation" trigger is pressed. */
  onAddAnnotation?: (artifactId: string) => void;
  /** EV-005 — fires when the depth-cap synthesis-prompt row is pressed. */
  onSynthesisPrompt?: (artifactId: string) => void;
}

export const SOURCE_CHAIN_POPOVER_OBSERVER_HELPER = 'Join a side to ask';

// Re-exported for tests as a stable named constant.
const OBSERVER_HELPER = SOURCE_CHAIN_POPOVER_OBSERVER_HELPER;

/**
 * Decide what affordances the popover should render given the model +
 * actor / viewer flags. Pure data, no React. Tests assert this matrix.
 */
export interface SourceChainPopoverPlan {
  /** True when the primary "ask" CTA should render. */
  showsAskCta: boolean;
  /** True when the read-only "Inspect receipt" affordance should render. */
  showsInspectAffordance: boolean;
  /**
   * True when the CTA renders disabled (observer mode). Caller wires
   * `disabled` + `accessibilityState.disabled` from this flag.
   */
  ctaDisabled: boolean;
  /** True when the observer helper ("Join a side to ask") should render. */
  showsObserverHelper: boolean;
}

export interface SourceChainPopoverPlanInput {
  isReadOnly: boolean;
  hasPrimaryAction: boolean;
  isOwnMessage: boolean;
  isReadModeViewer: boolean;
}

export function planSourceChainPopover(input: SourceChainPopoverPlanInput): SourceChainPopoverPlan {
  const { isReadOnly, hasPrimaryAction, isOwnMessage, isReadModeViewer } = input;
  // Authors never "ask themselves." Hide every ask CTA.
  const hideAskCta = isOwnMessage;
  const showsAskCta = hasPrimaryAction && !hideAskCta;
  const showsInspectAffordance = isReadOnly || hideAskCta;
  return {
    showsAskCta,
    showsInspectAffordance,
    // Observer disable applies only when an "ask" CTA actually renders.
    ctaDisabled: showsAskCta && isReadModeViewer,
    showsObserverHelper: showsAskCta && isReadModeViewer,
  };
}

/**
 * Build the root accessibilityLabel for the popover from the model + the
 * own/observer flags. Pure.
 */
export function buildSourceChainPopoverAccessibilityLabel(
  modelAccessibilityLabel: string,
  hasPrimaryAction: boolean,
  isOwnMessage: boolean,
  isReadModeViewer: boolean,
): string {
  const parts: string[] = [modelAccessibilityLabel];
  if (isOwnMessage) parts.push('Your own message — inspection only.');
  if (isReadModeViewer && hasPrimaryAction) parts.push(`${OBSERVER_HELPER}.`);
  return parts.join(' ');
}

function hostnameOfSafe(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function ArtifactRow({ artifact, index }: { artifact: EvidenceArtifact; index: number }): ReactElement {
  const host = hostnameOfSafe(artifact.url);
  const onOpenUrl = artifact.url
    ? () => {
        // Linking may reject on web / unsupported scheme — swallow defensively.
        void Linking.openURL(artifact.url!).catch(() => undefined);
      }
    : undefined;
  return (
    <View style={styles.artifactRow} testID={`source-chain-artifact-${index}`}>
      <Text style={styles.artifactLabel} numberOfLines={1}>
        {artifact.label}
      </Text>
      {host && onOpenUrl ? (
        <Pressable
          onPress={onOpenUrl}
          accessibilityRole="link"
          accessibilityLabel={`Open source at ${host}`}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={styles.artifactHost} numberOfLines={1}>
            {host}
          </Text>
        </Pressable>
      ) : host ? (
        <Text style={styles.artifactHost} numberOfLines={1}>
          {host}
        </Text>
      ) : null}
      {artifact.quote ? (
        <Text style={styles.artifactQuote} numberOfLines={3}>
          {`“${artifact.quote}”`}
        </Text>
      ) : null}
      {!artifact.quote && artifact.sourceText ? (
        <Text style={styles.artifactQuote} numberOfLines={3}>
          {artifact.sourceText}
        </Text>
      ) : null}
    </View>
  );
}

export function SourceChainPopover({
  model,
  artifacts,
  onAskAction,
  messageId,
  isExpanded,
  onToggleExpanded,
  isReadModeViewer = false,
  isOwnMessage = false,
  reduceMotion = false,
  annotations = [],
  annotationSummary,
  annotationDepthCap,
  canAddAnnotation = false,
  onAddAnnotation,
  onSynthesisPrompt,
}: SourceChainPopoverProps): ReactElement | null {
  const handleToggle = useCallback(() => {
    if (!reduceMotion) {
      try {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      } catch {
        /* swallow — some platforms / mocked test environments lack this. */
      }
    }
    onToggleExpanded();
  }, [reduceMotion, onToggleExpanded]);

  const action = model.primaryAction;
  const plan = planSourceChainPopover({
    isReadOnly: model.isReadOnly,
    hasPrimaryAction: action !== null,
    isOwnMessage,
    isReadModeViewer,
  });

  const handlePressCta = useCallback(() => {
    if (!action || !action.bubbleControl) return;
    if (isReadModeViewer) return; // observer disabled
    onAskAction?.(action.bubbleControl, messageId);
  }, [action, isReadModeViewer, messageId, onAskAction]);

  // Defensive short-circuit: a missing messageId means the popover has
  // no anchor and should render nothing. Placed AFTER hooks to satisfy
  // rules-of-hooks.
  if (!messageId) return null;

  const displayedArtifacts = artifacts.slice(0, 3);
  const extraCount = Math.max(0, artifacts.length - displayedArtifacts.length);

  const renderReadOnlyBlock = isExpanded && plan.showsInspectAffordance && artifacts.length > 0;

  const rootAccessibilityLabel = buildSourceChainPopoverAccessibilityLabel(
    model.accessibilityLabel,
    action !== null,
    isOwnMessage,
    isReadModeViewer,
  );
  const showCta = plan.showsAskCta;

  // EV-005 — the annotation stream renders when the popover is expanded AND
  // either the viewer can add an annotation or annotations already exist.
  // When no annotation props are supplied the popover behaves exactly as
  // EV-002 does today (annotations defaults to [], canAddAnnotation false).
  const resolvedAnnotationSummary: EvidenceAnnotationSummary | null =
    annotationSummary ?? model.annotationSummary ?? null;
  const resolvedDepthCap: AnnotationDepthCapResult = annotationDepthCap ?? {
    accepted: annotations,
    suppressed: [],
    showsSynthesisPrompt: false,
    synthesisPromptLabel: '',
  };
  const firstArtifactId = artifacts.length > 0 ? artifacts[0].id : '';
  const showsAnnotationStream =
    isExpanded &&
    resolvedAnnotationSummary !== null &&
    (annotations.length > 0 || canAddAnnotation);

  return (
    <View
      style={styles.root}
      accessibilityRole="none"
      accessibilityLabel={rootAccessibilityLabel}
      testID={`source-chain-popover-${messageId}`}
    >
      <Pressable
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityLabel={`${isExpanded ? 'Collapse' : 'Expand'} source-chain inspection`}
        accessibilityState={{ expanded: isExpanded }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.headerRow}
        testID={`source-chain-toggle-${messageId}`}
      >
        <Text style={styles.headline} numberOfLines={1}>
          {model.headline}
        </Text>
        <Text style={styles.toggleArrow}>{isExpanded ? '▾' : '▸'}</Text>
      </Pressable>

      {isExpanded ? (
        <View style={styles.body}>
          <Text style={styles.helper} numberOfLines={3}>
            {model.helper}
          </Text>

          {renderReadOnlyBlock ? (
            <View style={styles.artifactList} testID={`source-chain-artifacts-${messageId}`}>
              {displayedArtifacts.map((art, i) => (
                <ArtifactRow key={art.id} artifact={art} index={i} />
              ))}
              {extraCount > 0 ? (
                <Text style={styles.extraCount}>{`+${extraCount} more`}</Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.ctaRow}>
            {showCta && action ? (
              <Pressable
                onPress={handlePressCta}
                disabled={isReadModeViewer}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityHint={action.accessibilityHint}
                accessibilityState={{ disabled: isReadModeViewer }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={[
                  styles.cta,
                  action.tone === 'attention' && styles.ctaAttention,
                  isReadModeViewer && styles.ctaDisabled,
                ]}
                testID={`source-chain-cta-${messageId}`}
              >
                <Text style={styles.ctaText} numberOfLines={1}>
                  {action.label}
                </Text>
              </Pressable>
            ) : null}

            {plan.showsInspectAffordance ? (
              <View
                accessibilityRole="text"
                accessibilityLabel="Inspect receipt only"
                style={[styles.cta, styles.ctaInspect]}
                testID={`source-chain-inspect-${messageId}`}
              >
                <Text style={styles.ctaText} numberOfLines={1}>
                  Inspect receipt
                </Text>
              </View>
            ) : null}
          </View>

          {plan.showsObserverHelper ? (
            <Text style={styles.observerHelper} testID={`source-chain-observer-helper-${messageId}`}>
              {OBSERVER_HELPER}
            </Text>
          ) : null}

          {showsAnnotationStream && resolvedAnnotationSummary ? (
            <EvidenceAnnotationStream
              summary={resolvedAnnotationSummary}
              annotations={annotations}
              depthCap={resolvedDepthCap}
              canAddAnnotation={canAddAnnotation}
              onPressAddAnnotation={
                onAddAnnotation ? () => onAddAnnotation(firstArtifactId) : undefined
              }
              onPressSynthesisPrompt={
                onSynthesisPrompt ? () => onSynthesisPrompt(firstArtifactId) : undefined
              }
              isReadModeViewer={isReadModeViewer}
              messageId={messageId}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 8,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 36,
  },
  headline: { color: '#e2e8f0', fontWeight: '700', fontSize: 12, flex: 1 },
  toggleArrow: { color: '#94a3b8', fontSize: 12, marginLeft: 8 },
  body: { paddingHorizontal: 10, paddingBottom: 10, gap: 6 },
  helper: { color: '#cbd5e1', fontSize: 12, lineHeight: 16 },
  artifactList: { gap: 6, marginTop: 4 },
  artifactRow: { backgroundColor: '#0f172a', borderRadius: 6, padding: 6, gap: 2 },
  artifactLabel: { color: '#e2e8f0', fontSize: 12, fontWeight: '700' },
  artifactHost: { color: '#7dd3fc', fontSize: 11 },
  artifactQuote: { color: '#cbd5e1', fontSize: 11, fontStyle: 'italic' },
  extraCount: { color: '#94a3b8', fontSize: 11 },
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  cta: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0c4a6e',
    borderRadius: 999,
    minHeight: 32,
    justifyContent: 'center',
  },
  ctaAttention: { backgroundColor: '#7c2d12' },
  ctaInspect: { backgroundColor: '#1f2937' },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: '#f8fafc', fontWeight: '700', fontSize: 12 },
  observerHelper: { color: '#94a3b8', fontSize: 11, fontStyle: 'italic' },
});
