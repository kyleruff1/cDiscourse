/**
 * ADMIN-AI-001 — Admin Semantic Referee tab.
 *
 * Lets an authenticated admin switch the semantic-referee provider mode
 * (`anthropic` / `mock` / `fixture`; `mcp` reserved + disabled) and toggle the
 * runtime `enabled` flag — with no env-var edit and no redeploy. The runtime
 * source of truth is the persisted DB config; this tab reads + writes it
 * through the `admin-users` Edge Function.
 *
 * Doctrine:
 *   - The Anthropic provider key is NEVER displayed — the tab shows only an
 *     "Anthropic key present: Yes/No" boolean.
 *   - Switching to `anthropic` opens a confirmation panel ("Anthropic mode may
 *     use provider credits."). Switching to `mock` / `fixture` is one-click.
 *   - The surface states neutral facts only — it makes no judgment about a
 *     person or a claim, and the provider mode never affects standing, score,
 *     or who is right.
 *   - Pure RN primitives — no new dependency.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import {
  adminGetSemanticRefereeConfig,
  adminSetSemanticRefereeConfig,
  requiresProviderConfirmation,
  PROVIDER_MODE_LABELS,
} from './semanticRefereeConfigApi';
import { adminErrorMessage } from './adminHelpers';
import type {
  SemanticRefereeConfigView,
  SetSemanticRefereeConfigInput,
} from '../../lib/edgeFunctions';
import { formatDateTime, formatRelativeShort } from '../../lib/formatDateTime';
import { SURFACE_TOKENS, CONTROL, STATUS } from '../../lib/designTokens';

type LoadState = 'loading' | 'ready' | 'error';

/** The modes a row can show. `mcp` is shown disabled. */
const SELECTABLE_MODES: SemanticRefereeConfigView['providerMode'][] = [
  'anthropic',
  'mock',
  'fixture',
];

/** A one-line plain description of what each mode does. */
const MODE_DESCRIPTIONS: Record<SemanticRefereeConfigView['providerMode'], string> = {
  anthropic: 'Live provider. May use provider credits.',
  mock: 'Deterministic built-in responder. No provider calls, no credits.',
  fixture: 'Canned fixtures for development and testing.',
  mcp: 'Reserved for a future operator-hosted adapter. Not available yet.',
};

export function AdminSemanticRefereeTab() {
  const [config, setConfig] = useState<SemanticRefereeConfigView | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  // When set, the Anthropic confirmation panel is open for this pending change.
  const [pendingAnthropic, setPendingAnthropic] =
    useState<{ enabled: boolean } | null>(null);

  const fetchConfig = useCallback(async () => {
    setState('loading');
    setError(null);
    const r = await adminGetSemanticRefereeConfig();
    if (r.ok) {
      setConfig(r.data);
      setState('ready');
    } else {
      setError(adminErrorMessage(r.error, r.status));
      setState('error');
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  /** Perform the write and re-fetch so the admin sees the settled state. */
  const applyChange = useCallback(
    async (input: SetSemanticRefereeConfigInput) => {
      setSaving(true);
      setError(null);
      setStatusNote(null);
      const r = await adminSetSemanticRefereeConfig(input);
      if (r.ok) {
        setStatusNote(
          `Provider mode is now ${PROVIDER_MODE_LABELS[input.providerMode]}.`,
        );
        await fetchConfig();
      } else {
        setError(adminErrorMessage(r.error, r.status));
      }
      setSaving(false);
    },
    [fetchConfig],
  );

  /**
   * Choose a provider mode. Switching to `anthropic` opens the confirmation
   * panel; switching to `mock` / `fixture` applies immediately (one-click).
   */
  const onSelectMode = useCallback(
    (mode: SemanticRefereeConfigView['providerMode']) => {
      if (!config || saving) return;
      if (mode === 'mcp') return; // disabled — reserved for MCP-018.
      if (requiresProviderConfirmation(mode)) {
        setPendingAnthropic({ enabled: config.enabled });
        return;
      }
      void applyChange({ providerMode: mode, enabled: config.enabled });
    },
    [config, saving, applyChange],
  );

  /** Confirm the pending Anthropic switch. */
  const onConfirmAnthropic = useCallback(() => {
    if (!pendingAnthropic) return;
    const next = pendingAnthropic;
    setPendingAnthropic(null);
    void applyChange({
      providerMode: 'anthropic',
      enabled: next.enabled,
      confirmAnthropic: true,
    });
  }, [pendingAnthropic, applyChange]);

  const onCancelAnthropic = useCallback(() => {
    setPendingAnthropic(null);
  }, []);

  /**
   * Toggle the runtime enabled flag, keeping the current provider mode.
   * Disabled when the current mode is `mcp` — `mcp` is not a settable value,
   * so a write that keeps it is impossible; the admin must pick a real mode
   * first. (`mcp` only ever appears via a manual SQL edit.)
   */
  const enabledToggleAvailable =
    config != null && config.providerMode !== 'mcp';

  const onToggleEnabled = useCallback(() => {
    if (!config || saving) return;
    if (config.providerMode === 'mcp') return; // not a settable mode.
    if (requiresProviderConfirmation(config.providerMode)) {
      // Toggling while Anthropic is the mode still routes through the confirm
      // panel — any write that keeps `anthropic` needs the confirmation flag.
      setPendingAnthropic({ enabled: !config.enabled });
      return;
    }
    // config.providerMode is now 'mock' | 'fixture' — both settable.
    void applyChange({
      providerMode: config.providerMode,
      enabled: !config.enabled,
    });
  }, [config, saving, applyChange]);

  const lastChanged = useMemo(() => {
    if (!config?.updatedAt) return null;
    return `${formatDateTime(config.updatedAt)} · ${formatRelativeShort(config.updatedAt)}`;
  }, [config]);

  // ── Loading / error ─────────────────────────────────────────
  if (state === 'loading') {
    return (
      <View style={styles.centered} accessibilityLabel="admin-semantic-referee-loading">
        <ActivityIndicator color={SURFACE_TOKENS.textSecondary} />
        <Text style={styles.status}>Loading semantic referee settings…</Text>
      </View>
    );
  }
  if (state === 'error' || !config) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error} accessibilityLabel="admin-semantic-referee-error">
          Could not load semantic referee settings. Check admin access and try again.
          {error ? ` (detail: ${error})` : ''}
        </Text>
        <Pressable
          style={styles.refreshBtn}
          onPress={fetchConfig}
          accessibilityRole="button"
          accessibilityLabel="admin-semantic-referee-retry"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.refreshBtnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  // ── Ready ───────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      accessibilityLabel="admin-semantic-referee-tab"
      testID="admin-semantic-referee-tab"
    >
      {/* Status card — the current effective config. */}
      <View style={styles.card} testID="admin-semantic-referee-status">
        <Text style={styles.cardTitle}>Current setting</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Provider mode</Text>
          <Text style={styles.statusValue} accessibilityLabel="admin-semantic-referee-current-mode">
            {PROVIDER_MODE_LABELS[config.providerMode]}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Runtime state</Text>
          <Text style={styles.statusValue}>
            {config.enabled ? 'On' : 'Off'}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Config source</Text>
          <Text style={styles.statusValue}>Saved setting (database)</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Anthropic key present</Text>
          <Text
            style={styles.statusValue}
            accessibilityLabel="admin-semantic-referee-key-present"
          >
            {config.anthropicKeyPresent ? 'Yes' : 'No'}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Last changed</Text>
          <Text style={styles.statusValue}>{lastChanged ?? 'Not changed yet'}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Last changed by</Text>
          <Text style={styles.statusValue}>
            {config.updatedByDisplayName ?? '—'}
          </Text>
        </View>
        {!config.anthropicKeyPresent && config.providerMode === 'anthropic' && (
          <Text style={styles.keyWarning} accessibilityLabel="admin-semantic-referee-key-warning">
            Anthropic is selected but no provider key is configured. The referee
            will report itself unavailable until a key is set — rooms still work.
          </Text>
        )}
      </View>

      {/* Provider mode selector. */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Choose provider mode</Text>
        <Text style={styles.cardHelp}>
          This chooses which provider answers the advisory referee. It does not
          change scores, who is right, or whether a message can be posted.
        </Text>
        {SELECTABLE_MODES.map((mode) => {
          const active = config.providerMode === mode;
          return (
            <Pressable
              key={mode}
              style={[styles.modeRow, active && styles.modeRowActive]}
              onPress={() => onSelectMode(mode)}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={`admin-semantic-referee-mode-${mode}`}
              accessibilityState={{ selected: active, disabled: saving }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.modeRowMain}>
                <Text style={[styles.modeName, active && styles.modeNameActive]}>
                  {active ? '● ' : '○ '}{PROVIDER_MODE_LABELS[mode]}
                </Text>
                <Text style={styles.modeDesc}>{MODE_DESCRIPTIONS[mode]}</Text>
              </View>
              {active && <Text style={styles.modeActiveTag}>Active</Text>}
            </Pressable>
          );
        })}
        {/* mcp — shown disabled, labelled "Coming later". */}
        <View
          style={[styles.modeRow, styles.modeRowDisabled]}
          accessibilityLabel="admin-semantic-referee-mode-mcp"
          accessibilityState={{ disabled: true }}
        >
          <View style={styles.modeRowMain}>
            <Text style={styles.modeNameDisabled}>
              ○ {PROVIDER_MODE_LABELS.mcp}
            </Text>
            <Text style={styles.modeDesc}>{MODE_DESCRIPTIONS.mcp}</Text>
          </View>
          <Text style={styles.modeDisabledTag}>Not available</Text>
        </View>
      </View>

      {/* Runtime enabled toggle. */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Runtime state</Text>
        <Text style={styles.cardHelp}>
          Turn the referee off to stop all provider calls without changing the
          selected mode. Rooms keep working — the referee just stays quiet.
        </Text>
        <Pressable
          style={[styles.toggleRow, !enabledToggleAvailable && styles.modeRowDisabled]}
          onPress={onToggleEnabled}
          disabled={saving || !enabledToggleAvailable}
          accessibilityRole="switch"
          accessibilityLabel="admin-semantic-referee-enabled-toggle"
          accessibilityState={{
            checked: config.enabled,
            disabled: saving || !enabledToggleAvailable,
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.toggleText}>
            {config.enabled ? '☑ Referee is on' : '☐ Referee is off'}
          </Text>
        </Pressable>
        {!enabledToggleAvailable && (
          <Text style={styles.cardHelp}>
            Pick a real provider mode above before turning the referee on or off.
          </Text>
        )}
      </View>

      {/* Anthropic confirmation panel — the UX side of doctrine constraint #7.
          The server-side .refine() is the wall; this panel is the prompt. */}
      {pendingAnthropic && (
        <View
          style={styles.confirmPanel}
          accessibilityLabel="admin-semantic-referee-confirm-anthropic"
          testID="admin-semantic-referee-confirm-anthropic"
        >
          <Text style={styles.confirmTitle}>Switch to Anthropic?</Text>
          <Text style={styles.confirmBody}>
            Anthropic mode may use provider credits. Continue?
          </Text>
          <View style={styles.confirmActions}>
            <Pressable
              style={styles.confirmCancel}
              onPress={onCancelAnthropic}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="admin-semantic-referee-confirm-cancel"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={styles.confirmAccept}
              onPress={onConfirmAnthropic}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="admin-semantic-referee-confirm-accept"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.confirmAcceptText}>Continue</Text>
            </Pressable>
          </View>
        </View>
      )}

      {saving && (
        <View style={styles.savingRow} accessibilityLabel="admin-semantic-referee-saving">
          <ActivityIndicator color={SURFACE_TOKENS.textSecondary} />
          <Text style={styles.status}>Saving…</Text>
        </View>
      )}
      {statusNote && !saving && (
        <Text style={styles.successNote} accessibilityLabel="admin-semantic-referee-success">
          {statusNote}
        </Text>
      )}
      {error && !saving && (
        <Text style={styles.error} accessibilityLabel="admin-semantic-referee-save-error">
          Could not save the change. {error}
        </Text>
      )}

      <Text style={styles.footnote}>
        The provider mode chooses the source of the advisory referee only. It
        makes no judgment — it does not decide who is right, assign a score, or
        block any message.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SURFACE_TOKENS.base },
  content: { padding: 12, gap: 12 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: SURFACE_TOKENS.base,
  },
  status: { color: SURFACE_TOKENS.textSecondary, fontSize: 13 },
  error: {
    color: STATUS.danger.fg,
    backgroundColor: STATUS.danger.bg,
    fontSize: 13,
    padding: 10,
    borderRadius: 6,
  },
  card: {
    backgroundColor: SURFACE_TOKENS.elevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    padding: 12,
    gap: 6,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },
  cardHelp: { fontSize: 11, color: SURFACE_TOKENS.textSecondary, marginBottom: 4 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  statusLabel: { fontSize: 12, color: SURFACE_TOKENS.textSecondary },
  statusValue: {
    fontSize: 12,
    fontWeight: '600',
    color: SURFACE_TOKENS.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
  },
  keyWarning: {
    fontSize: 11,
    color: STATUS.warning.fg,
    backgroundColor: STATUS.warning.bg,
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.divider,
    backgroundColor: SURFACE_TOKENS.base,
    marginTop: 4,
  },
  modeRowActive: {
    borderColor: CONTROL.primary.bg,
    backgroundColor: STATUS.info.bg,
  },
  modeRowDisabled: { opacity: 0.55 },
  modeRowMain: { flex: 1, gap: 2, marginRight: 8 },
  modeName: { fontSize: 13, fontWeight: '600', color: SURFACE_TOKENS.textPrimary },
  modeNameActive: { color: STATUS.info.fg },
  modeNameDisabled: { fontSize: 13, fontWeight: '600', color: SURFACE_TOKENS.textMuted },
  modeDesc: { fontSize: 11, color: SURFACE_TOKENS.textSecondary },
  modeActiveTag: { fontSize: 10, fontWeight: '700', color: STATUS.info.fg },
  modeDisabledTag: { fontSize: 10, fontWeight: '700', color: SURFACE_TOKENS.textMuted },
  toggleRow: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.divider,
    backgroundColor: SURFACE_TOKENS.base,
    marginTop: 4,
  },
  toggleText: { fontSize: 13, fontWeight: '600', color: SURFACE_TOKENS.textPrimary },
  confirmPanel: {
    backgroundColor: SURFACE_TOKENS.overlay,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: STATUS.warning.bg,
    padding: 12,
    gap: 8,
  },
  confirmTitle: { fontSize: 13, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },
  confirmBody: { fontSize: 12, color: SURFACE_TOKENS.textSecondary },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  confirmCancel: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    backgroundColor: SURFACE_TOKENS.elevated,
  },
  confirmCancelText: { fontSize: 12, fontWeight: '600', color: SURFACE_TOKENS.textPrimary },
  confirmAccept: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: CONTROL.primary.bg,
  },
  confirmAcceptText: { fontSize: 12, fontWeight: '700', color: CONTROL.primary.fg },
  savingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  successNote: {
    fontSize: 12,
    color: STATUS.success.fg,
    backgroundColor: STATUS.success.bg,
    padding: 10,
    borderRadius: 6,
  },
  refreshBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: CONTROL.primary.bg,
  },
  refreshBtnText: { color: CONTROL.primary.fg, fontSize: 12, fontWeight: '700' },
  footnote: {
    fontSize: 10,
    color: SURFACE_TOKENS.textMuted,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
