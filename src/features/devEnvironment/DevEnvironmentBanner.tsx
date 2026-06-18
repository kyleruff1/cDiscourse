import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getBuildInfo,
  getDeployEnvironmentLabel,
  getReportIssueUrl,
  shouldShowDevBanner,
  type DevEnvironmentInputs,
} from './devEnvironmentModel';

interface DevEnvironmentBannerProps {
  /** Inject env for testing. Defaults to `process.env`. */
  env?: DevEnvironmentInputs;
}

/**
 * Visible banner that marks any non-production build as dev / preview /
 * local / unverified. Returns `null` in production. The banner shows:
 *   - app name + environment label ("CDiscourse · Dev")
 *   - commit hash + build version when provided
 *   - "Test data may be reset" warning
 *   - Report-issue link
 *
 * All copy is plain language. Long-form secret shapes accidentally
 * routed through `EXPO_PUBLIC_*` are stripped by `getBuildInfo`.
 */
export function DevEnvironmentBanner({ env }: DevEnvironmentBannerProps): React.ReactElement | null {
  const resolvedEnv = env ?? (process.env as DevEnvironmentInputs);
  if (!shouldShowDevBanner(resolvedEnv)) {
    return null;
  }

  const envLabel = getDeployEnvironmentLabel(resolvedEnv);
  const { commitHash, buildVersion } = getBuildInfo(resolvedEnv);
  const reportUrl = getReportIssueUrl(resolvedEnv);

  const buildParts: string[] = [];
  if (buildVersion) buildParts.push(buildVersion);
  if (commitHash) buildParts.push(commitHash);
  const buildLabel = buildParts.length > 0 ? buildParts.join(' · ') : 'no build metadata';

  return (
    <View
      style={styles.banner}
      accessibilityRole="alert"
      accessibilityLabel={`This is a non-production CivilDiscourse build (${envLabel}). Test data may be reset.`}
      testID="dev-environment-banner"
    >
      <View style={styles.row}>
        <View style={styles.tag} testID="dev-banner-env-tag">
          <Text style={styles.tagText}>{`CivilDiscourse · ${envLabel}`}</Text>
        </View>
        <Text style={styles.buildText} testID="dev-banner-build">{buildLabel}</Text>
      </View>
      <Text style={styles.noticeText} testID="dev-banner-notice">
        Test data may be reset. Bot / test rooms are clearly labeled and are not real debates.
      </Text>
      <Pressable
        onPress={() => { void Linking.openURL(reportUrl); }}
        accessibilityRole="link"
        accessibilityLabel="Report an issue with this dev build"
        testID="dev-banner-report-link"
      >
        <Text style={styles.linkText}>Report an issue →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#78350f',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#fef3c7',
  },
  tagText: {
    color: '#78350f',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.4,
  },
  buildText: {
    color: '#fde68a',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  noticeText: {
    color: '#fde68a',
    fontSize: 12,
  },
  linkText: {
    color: '#fef3c7',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
